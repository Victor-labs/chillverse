// src/features/support/AdminSupport.tsx
// Thin route wrapper — the CMS itself lives in ./admin (SupportAdminShell +
// tabs), mirroring how AdminBlog wraps BlogAdminShell.
import SupportAdminShell from './admin/SupportAdminShell'

export default function AdminSupport() {
  return <SupportAdminShell />
}
