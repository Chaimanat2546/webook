# Booking customer validation

All customer fields are optional, including name and phone. An untouched form can
be saved. Existing defaults remain unchanged. Blank names and primary phone numbers
are stored as empty strings to retain the existing non-null database contract.

Every wizard navigation action validates the current section. Supplied values use
the existing format/length rules; invalid fields show inline messages and block
navigation. Before review and final submission, all sections are checked again.
The server repeats validation before writes. Thai birthday drafts are validated
in General information and converted to Gregorian dates for persistence.

Empty phone numbers bypass duplicate lookup on both creation and update. Nonempty
phones retain the existing house-scoped duplicate behavior. A nameless customer
is displayed as `ลูกค้า #<id>` without inventing a stored name.

No schema migration or deployment is required for this local change.
