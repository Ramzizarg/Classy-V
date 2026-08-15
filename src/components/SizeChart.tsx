import type { SizeTable } from "@/lib/size-guide";

export function SizeChart({ table }: { table: SizeTable }) {
  return (
    <div className="mt-6">
      <p className="section-title">{table.title} — cm</p>
      <div className="mt-2 max-w-2xl overflow-x-auto border border-line">
        <table className="w-full min-w-[440px]">
          <thead>
            <tr className="border-b border-line">
              {table.head.map((cell) => (
                <th key={cell} scope="col" className="ui px-2 py-2 text-left">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row[0]} className="border-b border-line last:border-b-0">
                {row.map((cell, index) => (
                  <td
                    key={`${row[0]}-${index}`}
                    className={`ui-sm px-2 py-2 tabular-nums ${index === 0 ? "font-bold" : "text-muted"}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
