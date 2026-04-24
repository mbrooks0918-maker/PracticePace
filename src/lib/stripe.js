import { loadStripe } from '@stripe/stripe-js'

export const getStripe = (() => {
  let stripePromise = null
  return () => {
    if (!stripePromise) {
      stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
    }
    return stripePromise
  }
})()
