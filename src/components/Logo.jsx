import logo from '../assets/Practice_Pace.svg'
import icon  from '../assets/practicepace-icon-standalone.svg'

export default function Logo({ variant = 'default', height = 48, className = '', style, ...props }) {
  const src = variant === 'icon' ? icon : logo
  return (
    <img
      src={src}
      alt="PracticePace"
      height={height}
      className={className}
      style={{ height: `${height}px`, width: 'auto', display: 'block', ...style }}
      draggable={false}
      {...props}
    />
  )
}
