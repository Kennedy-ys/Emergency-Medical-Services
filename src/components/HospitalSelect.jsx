import { Fragment, useState } from "react";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

export default function HospitalSelect({ hospitals, form, setForm }) {
  const [query, setQuery] = useState("");

  const filteredHospitals =
    query === ""
      ? hospitals
      : hospitals.filter((h) =>
          h.name.toLowerCase().includes(query.toLowerCase())
        );

  return (
    <div className="w-full">
      <Combobox
        value={form.hospital}
        onChange={(value) => setForm((prev) => ({ ...prev, hospital: value }))}
      >
        <div className="relative mt-1">
          {/* Input */}
          <div className="relative w-full cursor-default overflow-hidden rounded-md border-b-2 border-b-blue-200 bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm">
            <ComboboxInput
              className="w-full border-none py-3 pl-4 pr-10 text-sm leading-5 text-gray-900 focus:ring-0 outline-none"
              displayValue={(hospital) => hospital}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Select Destination Hospital"
            />
            <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </ComboboxButton>
          </div>

          {/* Slide + Fade Animation */}
          <Transition
            as={Fragment}
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-1"
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 -translate-y-1"
            enterTo="opacity-100 translate-y-0"
            afterLeave={() => setQuery("")}
          >
            <ComboboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {filteredHospitals.length === 0 && query !== "" ? (
                <div className="relative cursor-default select-none py-2 px-4 text-gray-500">
                  No hospital found.
                </div>
              ) : (
                filteredHospitals.map((h, i) => (
                  <ComboboxOption
                    key={i}
                    value={h.name}
                    className={({ focus }) =>
                      `relative cursor-pointer select-none py-3 pl-10 pr-4 ${
                        focus
                          ? "bg-blue-100 text-blue-900"
                          : "text-gray-900"
                      }`
                    }
                  >
                    {({ selected }) => (
                      <>
                        <span
                          className={`block truncate ${
                            selected ? "font-medium" : "font-normal"
                          }`}
                        >
                          {h.name}
                        </span>
                        {selected ? (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </ComboboxOption>
                ))
              )}
            </ComboboxOptions>
          </Transition>
        </div>
      </Combobox>
    </div>
  );
}
