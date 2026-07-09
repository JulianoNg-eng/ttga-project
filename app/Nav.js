"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/", label: "Draw" },
  { href: "/photos", label: "Photos" },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <div className="flex items-center justify-center gap-2">
      {TABS.map(({ href, label }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`px-4 py-1.5 rounded-full font-semibold text-sm transition ease-out duration-150 ${
              active
                ? "bg-[#ff4b81] text-white"
                : "bg-[#333] text-white hover:bg-[#444] active:bg-[#555]"
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
