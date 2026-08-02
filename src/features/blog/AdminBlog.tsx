// src/features/blog/AdminBlog.tsx
// Thin route wrapper — the actual CMS lives in ./admin (BlogAdminShell + tabs),
// split out because the full Blog CMS (dashboard, articles table, editor,
// media library, categories/tags manager) is too large for one file.
import BlogAdminShell from './admin/BlogAdminShell'

export default function AdminBlog() {
  return <BlogAdminShell />
}
