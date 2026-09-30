"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"

/** Light mode only — PaperString ships a single permanent light color
 *  scheme, so toasts are always rendered in the light theme regardless
 *  of the visitor's OS preference. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
