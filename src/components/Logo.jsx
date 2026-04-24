import logoWhite from '../assets/practicepace-logo-white-text.svg'
import logoBlack from '../assets/practicepace-logo-black-text.svg'
import logoDark   from '../assets/practicepace-logo-dark.svg'      // red+white, used until red-text variant is added
import icon       from '../assets/practicepace-icon-standalone.svg'

const SRCS = {
  white: logoWhite,
  black: logoBlack,
  red:   logoDark,
  icon,
}

export default function Logo({ variant = 'white', height = 48, className = '', style, ...props }) {
  const src = SRCS[variant] ?? logoWhite
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
