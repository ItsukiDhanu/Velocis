import { NavLink } from "react-router-dom";

const navItems = [{ to: "/", label: "Dashboard" }];

export default function Sidebar() {
  return (
    <aside className="hidden w-64 flex-col border-r border-ink-700 bg-ink-900/95 p-5 md:flex">
      <div className="mb-8">
        <div className="text-lg font-semibold text-snow">Velocis</div>
      </div>
      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-ink-800 text-snow border border-ink-700"
                  : "text-mist hover:text-snow hover:bg-ink-800/60"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
