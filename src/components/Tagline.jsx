export default function Tagline({ className = '', style }) {
  return (
    <p
      className={`text-sm italic tracking-widest text-center select-none ${className}`}
      style={{ color: '#9a8080', letterSpacing: '0.12em', ...style }}
    >
      Practice smarter. Win more.
    </p>
  )
}
