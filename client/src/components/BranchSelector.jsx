export default function BranchSelector({ branches, value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-mist">Current branch</label>
      <select
        value={value || ""}
        onChange={(event) => onChange(Number(event.target.value))}
        className="input"
      >
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}
