import { matchDelegation, matchGovernorate } from "@/lib/xdeliveryLocations";

export type CheckoutFormFields = {
  email: string;
  fullName: string;
  address: string;
  governorate: string;
  city: string;
  phone: string;
  phone2: string;
  note: string;
};

export type CheckoutFieldKey = keyof CheckoutFormFields;
export type CheckoutFieldErrors = Partial<Record<CheckoutFieldKey, string>>;

export const EMPTY_CHECKOUT_FORM: CheckoutFormFields = {
  email: "",
  fullName: "",
  address: "",
  governorate: "",
  city: "",
  phone: "",
  phone2: "",
  note: "",
};

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Required: name, governorate, delegation, address, phone. Email optional. */
export function validateCheckoutRequired(form: CheckoutFormFields): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  const email = form.email.trim();
  const fullName = form.fullName.trim().replace(/\s+/g, " ");
  const address = form.address.trim();
  const phone = form.phone.trim();

  if (email && !EMAIL_OK.test(email)) errors.email = "Enter a valid email address.";

  if (!fullName) errors.fullName = "Full name is required.";
  else if (fullName.length < 2) errors.fullName = "Enter your full name.";

  const governorateName = matchGovernorate(form.governorate);
  if (!governorateName) errors.governorate = "Governorate is required.";
  else if (!matchDelegation(governorateName, form.city)) {
    errors.city = "Delegation is required.";
  }

  if (!address) errors.address = "Address is required.";
  if (!phone) errors.phone = "Phone is required.";

  return errors;
}

export const CHECKOUT_FIELD_ORDER: CheckoutFieldKey[] = [
  "fullName",
  "governorate",
  "city",
  "address",
  "phone",
  "email",
];
