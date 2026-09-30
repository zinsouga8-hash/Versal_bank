import * as React from "react"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={`block w-full max-w-full text-xs font-semibold text-[#1a1a1a] leading-snug break-words whitespace-normal select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 ${className || ''}`}
      {...props}
    />
  )
}

export { Label }
