export interface UpdateWorker extends EventTarget {
  state: string;
  postMessage(message: { type: string }): void;
}

export interface UpdateRegistration extends EventTarget {
  waiting: UpdateWorker | null;
  installing: UpdateWorker | null;
}

export interface UpdateContainer extends EventTarget {
  controller: UpdateWorker | null;
}

/** Observe both an already waiting update and updates installed later. Never reload. */
export function observeUpdates(
  registration: UpdateRegistration,
  container: UpdateContainer,
  onWaiting: (worker: UpdateWorker) => void,
  onChanged: () => void,
) {
  const watched = new Set<UpdateWorker>();
  const check = () => {
    if (registration.waiting && container.controller) onWaiting(registration.waiting);
  };
  const installing = () => {
    const worker = registration.installing;
    if (worker && !watched.has(worker)) {
      watched.add(worker);
      worker.addEventListener("statechange", check);
    }
    check();
  };
  let previous = container.controller;
  const changed = () => {
    // Initial installation is not an app update.
    if (previous && container.controller !== previous) onChanged();
    previous = container.controller;
  };
  registration.addEventListener("updatefound", installing);
  container.addEventListener("controllerchange", changed);
  installing();
  return () => {
    registration.removeEventListener("updatefound", installing);
    container.removeEventListener("controllerchange", changed);
    for (const worker of watched) worker.removeEventListener("statechange", check);
  };
}

/** Only called after explicit user confirmation; other windows never reload. */
export function activateUpdate(container: UpdateContainer, worker: UpdateWorker, timeoutMs = 12000): Promise<void> {
  return new Promise((resolve, reject) => {
    const previous = container.controller;
    const cleanup = () => {
      clearTimeout(timer);
      container.removeEventListener("controllerchange", changed);
    };
    const changed = () => {
      if (container.controller && container.controller !== previous) {
        cleanup();
        resolve();
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Update activation timed out"));
    }, timeoutMs);
    container.addEventListener("controllerchange", changed);
    try {
      worker.postMessage({ type: "WEBOOK_ACTIVATE_UPDATE" });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
