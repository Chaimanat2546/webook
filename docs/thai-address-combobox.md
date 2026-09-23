# Customer address combobox integration

Address combobox popups must use a container inside the customer dialog so Radix modal pointer and focus handling includes the Base UI popup. Keep the dialog's outside-interaction guard; allowing outside interactions can dismiss the form.

Form background styles must target `data-slot=input`, not every descendant input. `InputGroupInput` uses `data-slot=input-group-control` and a transparent background; forcing an opaque background on its full-height input covers the input group's top and bottom borders.

Labels use `htmlFor` with a unique input ID rather than wrapping the input, trigger, hidden input, and popup in one label.

Browser verification: search and select Saraburi, Chaloem Phra Kiat, and Phu Khae; postcode becomes 18240. All three outlines remain visible after blur, and selection leaves the customer dialog open. Do not save verification data.
