"use client";

type Props = {
  defaultValue?: string;
  autoFocus?: boolean;
};

export function TrackSearchForm({ defaultValue = "", autoFocus = false }: Props) {
  return (
    <form method="get" className="track-search">
      <label className="min-w-0 flex-1">
        <span className="ui-sm text-muted">Reference or barcode</span>
        <input
          name="ref"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="CV-XXXXXXX"
          aria-label="Order reference or X-Delivery barcode"
          className="field track-field mt-2 uppercase"
          onFocus={(event) => event.currentTarget.select()}
          onInput={(event) => {
            event.currentTarget.value = event.currentTarget.value.toUpperCase();
          }}
        />
      </label>
      <button type="submit" className="btn btn--solid track-search__btn">
        Track
      </button>
    </form>
  );
}
