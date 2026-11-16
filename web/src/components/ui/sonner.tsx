"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const icon = "size-5"

// The app is light-only; sonner's "system" theme would paint dark-mode text onto paper toasts.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      offset={{ top: 72 }}
      mobileOffset={{ top: 64, left: 12, right: 12 }}
      icons={{
        success: <CircleCheckIcon className={icon} strokeWidth={2.25} aria-hidden />,
        info: <InfoIcon className={icon} strokeWidth={2.25} aria-hidden />,
        warning: <TriangleAlertIcon className={icon} strokeWidth={2.25} aria-hidden />,
        error: <OctagonXIcon className={icon} strokeWidth={2.25} aria-hidden />,
        loading: <Loader2Icon className={`${icon} animate-spin`} strokeWidth={2.25} aria-hidden />,
      }}
      toastOptions={{ classNames: { toast: "pr-toast" } }}
      {...props}
    />
  )
}

export { Toaster }
