import Link from 'next/link'
import { SessionPayload } from '@/lib/session'
import {
  LayoutDashboard,
  Megaphone,
  ShoppingBag,
  BarChart3,
  FileText,
  Settings,
  Users,
  Plug,
} from 'lucide-react'

type Client = { id: string; name: string; logoUrl: string | null; primaryColor: string; slug: string } | null

const clientNav = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/meta', label: 'Meta Ads', icon: Megaphone },
  { href: '/shopify', label: 'Shopify', icon: ShoppingBag },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/reports', label: 'Reports', icon: FileText },
]

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/connections', label: 'Connections', icon: Plug },
]

export default function Sidebar({
  session,
  client,
}: {
  session: SessionPayload
  client: Client
}) {
  const isAdmin = session.role === 'SUPER_ADMIN'
  const navItems = isAdmin ? adminNav : clientNav
  const brandColor = client?.primaryColor ?? '#6366f1'

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo / Brand */}
      <div className="p-5 border-b border-gray-200">
        {client?.logoUrl ? (
          <img src={client.logoUrl} alt={client.name} className="h-8 object-contain" />
        ) : (
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: brandColor }}
            >
              {isAdmin ? 'K' : client?.name[0] ?? 'K'}
            </div>
            <span className="font-semibold text-gray-900 text-sm">
              {isAdmin ? 'Klickkk : Performance Reports' : (client?.name ?? 'Dashboard')}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-200">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Settings size={16} />
          Settings
        </Link>
      </div>
    </aside>
  )
}
