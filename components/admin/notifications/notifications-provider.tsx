"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { readNotifications, unsubscribePush } from "../../../app/admin/notifications/actions";
import type { NotificationCursor, NotificationFilter, NotificationFeedPage } from "../../../lib/booking-notifications";
import { shouldRefreshNotifications, visibleNotificationPage } from "./inbox-state";
import { NotificationsContext } from "./notifications-context";
import { NotificationsSheet } from "./notifications-sheet";
import { currentPushSubscription, optOutPushDevice, PUSH_ACTOR_STORAGE_KEY, storePushActor, withTimeout } from "./push-device";

interface InboxSession {
  surface: "sheet" | "page";
  hasRead: boolean;
  onLoaded: (snapshot: NotificationFeedPage, explicitlyAccepted: boolean) => Promise<void>;
}

export function NotificationsProvider({ children, actorId }: { children: ReactNode; actorId?: string }) {
  const [data, setData] = useState<NotificationFeedPage | null>(null);
  const [observedAt, setObservedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpenState] = useState(false);
  const [filter, setFilterState] = useState<NotificationFilter>("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const feed = useRef<NotificationFeedPage | null>(null);
  const activeFilter = useRef<NotificationFilter>("all");
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const moreRequest = useRef<AbortController | null>(null);
  const pollRequest = useRef<AbortController | null>(null);
  const signedOut = useRef(false);
  const inboxSession = useRef<InboxSession | null>(null);
  const setOpen = useCallback((value: boolean) => {
    // Radix keeps closing content mounted for its animation; cancel reading immediately.
    if (!value && inboxSession.current?.surface === "sheet") inboxSession.current = null;
    setOpenState(value);
  }, []);
  const currentData = visibleNotificationPage(data, actorId);
  const currentActor = actorId ?? currentData?.actorId ?? null;

  const publish = useCallback((value: NotificationFeedPage | null) => { feed.current = value; setData(value); }, []);
  const abortRequests = useCallback(() => {
    generation.current++;
    request.current?.abort(); moreRequest.current?.abort(); pollRequest.current?.abort();
    request.current = null; moreRequest.current = null; pollRequest.current = null;
    setLoadingMore(false);
  }, []);
  const reportFailure = useCallback((caught: unknown) => {
    const message = caught instanceof Error ? caught.message : "unavailable";
    if (message === "session" || message === "actor") {
      abortRequests(); publish(null); setLoading(false);
      setError(message === "session" ? "กรุณาเข้าสู่ระบบอีกครั้งเพื่อดูการแจ้งเตือน" : "บัญชีมีการเปลี่ยนแปลง กรุณาโหลดหน้าอีกครั้ง");
    } else setError("โหลดการแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง");
  }, [abortRequests, publish]);
  const fetchFeed = useCallback(async (controller: AbortController, query: { cursor?: NotificationCursor; head?: NotificationCursor; tail?: NotificationCursor; windowCursor?: NotificationCursor } = {}) => {
    const params = new URLSearchParams({ filter: activeFilter.current });
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, JSON.stringify(value));
    const response = await withTimeout(fetch("/api/notifications?" + params.toString(), { cache: "no-store", credentials: "same-origin", signal: controller.signal }), 15_000);
    if (response.status === 401 || response.status === 403) throw new Error("session");
    if (!response.ok) throw new Error("unavailable");
    const next = await response.json() as NotificationFeedPage;
    if (actorId && next.actorId !== actorId) throw new Error("actor");
    return next;
  }, [actorId]);

  const acceptNew = useCallback(async (explicitlyAccepted = true) => {
    if (signedOut.current || !shouldRefreshNotifications(document.visibilityState, navigator.onLine)) return false;
    const session = inboxSession.current;
    let accepted: NotificationFeedPage | null = null;
    // Explicit refresh and category switches invalidate every older query.
    generation.current++;
    request.current?.abort(); moreRequest.current?.abort(); pollRequest.current?.abort();
    moreRequest.current = null; pollRequest.current = null;
    setLoadingMore(false); setLoadMoreError(null); setLoading(true);
    const controller = new AbortController(); request.current = controller;
    try {
      const next = await fetchFeed(controller);
      if (!controller.signal.aborted && !signedOut.current) {
        // Category changes keep an explicit acceptance path for new global unread items.
        publish({ ...next, hasNew: next.hasNew || Boolean(session?.hasRead && next.unreadCount > 0) });
        setObservedAt(next.asOf); setError(null); accepted = next;
      }
    } catch (caught) { if (!controller.signal.aborted && !signedOut.current) reportFailure(caught); }
    finally {
      if (request.current === controller) { request.current = null; setLoading(false); }
      controller.abort();
    }
    if (!accepted) return false;
    if (session && inboxSession.current === session) await session.onLoaded(accepted, explicitlyAccepted);
    return true;
  }, [fetchFeed, publish, reportFailure]);

  const refresh = useCallback(async () => {
    if (signedOut.current || !shouldRefreshNotifications(document.visibilityState, navigator.onLine)) return;
    if (!feed.current || (inboxSession.current && !inboxSession.current.hasRead)) { await acceptNew(false); return; }
    if (request.current || pollRequest.current) return;
    const current = feed.current;
    const head = current.items[0] ?? { createdAt: current.asOf, id: "ffffffff-ffff-ffff-ffff-ffffffffffff" };
    const tail = current.items.at(-1) ?? head;
    const knownIds = new Set(current.items.map(item => item.id));
    const controller = new AbortController(); pollRequest.current = controller;
    try {
      const window = { head: { createdAt: head.createdAt, id: head.id }, tail: { createdAt: tail.createdAt, id: tail.id } };
      let next = await fetchFeed(controller, window);
      if (controller.signal.aborted || signedOut.current || !feed.current) return;
      if (!next.retained) throw new Error("unavailable");
      const allowed = new Map(next.retained.map(item => [item.id, item]));
      let hasNew = next.hasNew;
      const cursors = new Set<string>();
      while (next.retainedCursor) {
        const key = JSON.stringify(next.retainedCursor);
        if (cursors.has(key)) throw new Error("unavailable");
        cursors.add(key);
        next = await fetchFeed(controller, { ...window, windowCursor: next.retainedCursor });
        if (controller.signal.aborted || signedOut.current || !feed.current) return;
        if (!next.retained) throw new Error("unavailable");
        for (const item of next.retained) allowed.set(item.id, item);
        hasNew ||= next.hasNew;
      }
      // A late commit with an older timestamp can appear inside the loaded window.
      hasNew ||= [...allowed.keys()].some(id => !knownIds.has(id));
      // Exhausted feeds also detect late commits below the old tail (including empty feeds).
      const survivingCount = [...knownIds].filter(id => allowed.has(id)).length;
      hasNew ||= current.nextCursor === null && next.total > survivingCount;
      hasNew ||= Boolean(inboxSession.current?.hasRead && next.unreadCount > 0);
      // Preserve rows appended while polling; only reconcile the requested window.
      publish({ ...feed.current, items: feed.current.items.flatMap(item => {
        if (!knownIds.has(item.id)) return [item];
        const replacement = allowed.get(item.id); return replacement ? [replacement] : [];
      }), unreadCount: next.unreadCount, total: next.total, hasNew, pushPublicKey: next.pushPublicKey });
      setObservedAt(next.asOf);
      setError(null);
    } catch (caught) { if (!controller.signal.aborted && !signedOut.current) reportFailure(caught); }
    finally { if (pollRequest.current === controller) pollRequest.current = null; controller.abort(); }
  }, [acceptNew, fetchFeed, publish, reportFailure]);

  const loadMore = useCallback(async () => {
    const current = feed.current;
    if (!current?.nextCursor || request.current || moreRequest.current || signedOut.current) return;
    if (!navigator.onLine) { setLoadMoreError("ออฟไลน์ กรุณาเชื่อมต่อแล้วลองอีกครั้ง"); return; }
    const controller = new AbortController(); moreRequest.current = controller;
    setLoadingMore(true); setLoadMoreError(null);
    try {
      const next = await fetchFeed(controller, { cursor: current.nextCursor });
      if (controller.signal.aborted || signedOut.current || !feed.current) return;
      const ids = new Set(feed.current.items.map(item => item.id));
      publish({ ...feed.current, items: [...feed.current.items, ...next.items.filter(item => !ids.has(item.id))], nextCursor: next.nextCursor });
    } catch (caught) {
      if (!controller.signal.aborted && !signedOut.current) {
        if (caught instanceof Error && (caught.message === "session" || caught.message === "actor")) reportFailure(caught);
        else setLoadMoreError("โหลดรายการเพิ่มเติมไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
    } finally {
      if (moreRequest.current === controller) { moreRequest.current = null; setLoadingMore(false); }
      controller.abort();
    }
  }, [fetchFeed, publish, reportFailure]);

  function setFilter(value: NotificationFilter) {
    abortRequests(); activeFilter.current = value; publish(null);
    setError(null); setLoadMoreError(null); setFilterState(value);
    void acceptNew(false);
  }
  useEffect(() => {
    const initialRefresh = window.setTimeout(() => { void refresh(); }, 0);
    const interval = window.setInterval(() => { void refresh(); }, 30_000);
    const resume = () => { void refresh(); };
    const storage = (event: StorageEvent) => {
      if (event.key !== PUSH_ACTOR_STORAGE_KEY || event.newValue === currentActor) return;
      abortRequests(); publish(null); void acceptNew(false);
    };
    window.addEventListener("focus", resume); window.addEventListener("online", resume);
    window.addEventListener("webook-notifications-refresh", resume);
    document.addEventListener("visibilitychange", resume); window.addEventListener("storage", storage);
    return () => {
      request.current?.abort(); moreRequest.current?.abort(); pollRequest.current?.abort();
      request.current = null; moreRequest.current = null; pollRequest.current = null;
      clearTimeout(initialRefresh); clearInterval(interval);
      window.removeEventListener("focus", resume); window.removeEventListener("online", resume);
      window.removeEventListener("webook-notifications-refresh", resume);
      document.removeEventListener("visibilitychange", resume); window.removeEventListener("storage", storage);
    };
  }, [refresh, acceptNew, currentActor, abortRequests, publish]);

  async function cleanupDevice() {
    signedOut.current = true; abortRequests(); publish(null); setOpen(false); storePushActor(null);
    try { return (await optOutPushDevice(currentPushSubscription, unsubscribePush)).complete; }
    catch { return false; } finally { storePushActor(null); }
  }
  const markRead = useCallback(async (input: { id: string } | { before: string }): Promise<boolean> => {
    const started = generation.current;
    try {
      const result = await withTimeout(readNotifications(input, actorId));
      if (!result.ok) throw new Error("unavailable");
      if (signedOut.current) return true;
      // Read state is fetched after the mutation; late actions use the current filter.
      if (started === generation.current) {
        moreRequest.current?.abort(); moreRequest.current = null; setLoadingMore(false);
      }
      pollRequest.current?.abort(); pollRequest.current = null;
      await refresh(); return true;
    } catch { toast.error("ทำเครื่องหมายอ่านไม่สำเร็จ กรุณาลองอีกครั้ง"); return false; }
  }, [refresh, actorId]);
  const beginInboxSession = useCallback((surface: "sheet" | "page" = "page") => {
    const session: InboxSession = {
      surface,
      hasRead: false,
      async onLoaded(snapshot, explicitlyAccepted) {
        if (inboxSession.current !== session || signedOut.current || document.visibilityState !== "visible") return;
        if (session.hasRead && !explicitlyAccepted) return;
        session.hasRead = true;
        if (snapshot.unreadCount > 0) await markRead({ before: snapshot.asOf });
      },
    };
    inboxSession.current = session;
    void acceptNew(false);
    return () => { if (inboxSession.current === session) inboxSession.current = null; };
  }, [acceptNew, markRead]);
  return <NotificationsContext.Provider value={{ data: currentData, observedAt, actorId: currentActor, loading, error, open, setOpen, filter, setFilter, loadingMore, loadMoreError, loadMore, acceptNew, beginInboxSession, refresh, markRead, cleanupDevice }}>
    {children}<NotificationsSheet />
  </NotificationsContext.Provider>;
}
