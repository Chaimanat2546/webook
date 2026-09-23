# Booking customer picker

The customer picker displays an always-visible **เพิ่มลูกค้าใหม่** button in the
same header div as **ลูกค้า**, above the search combobox. Creating a customer does not require a search or an empty
result. The dropdown only contains search results, status, and retry controls.

The separate button opens the existing customer form. Selection, duplicate-phone
handling, and confirmation when replacing an existing customer remain unchanged.

Manual check: open Create booking, click Add new customer without searching,
then cancel; the booking form should remain open and its customer unchanged.
