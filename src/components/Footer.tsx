export default function Footer() {
  return (
    <footer className="px-6 md:px-16 py-9 border-t border-chill-border flex items-center justify-between flex-wrap gap-4 text-chill-textMuted text-sm">
      <div className="flex items-center gap-2.5">
        <span className="text-lg font-bold text-gradient-2">Chillverse</span>
        <span>© 2026 · All rights reserved</span>
      </div>
      <div className="flex gap-6">
        <a href="https://cvwtplatform.vercel.app/" target="_blank" rel="noreferrer" className="hover:text-chill-textSecondary transition-colors">Platform</a>
        <a href="#" className="hover:text-chill-textSecondary transition-colors">About</a>
        <a href="/privacy" className="hover:text-chill-textSecondary transition-colors">Privacy</a>
        <a href="/terms" className="hover:text-chill-textSecondary transition-colors">Terms</a>
        <a href="#" className="hover:text-chill-textSecondary transition-colors">Contact</a>
      </div>
    </footer>
  )
}
