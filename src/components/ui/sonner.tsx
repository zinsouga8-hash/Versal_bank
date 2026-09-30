import React from "react";
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      duration={6000}
      closeButton={true}
      richColors={false}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-5 text-emerald-400 shrink-0" />
        ),
        info: (
          <InfoIcon className="size-5 text-sky-400 shrink-0" />
        ),
        warning: (
          <TriangleAlertIcon className="size-5 text-amber-400 shrink-0" />
        ),
        error: (
          <OctagonXIcon className="size-5 text-rose-400 shrink-0" />
        ),
        loading: (
          <Loader2Icon className="size-5 animate-spin text-amber-400 shrink-0" />
        ),
      }}
      toastOptions={{
        style: {
          background: '#090d16',
          color: '#f8fafc',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          padding: '16px 20px',
          fontSize: '14px',
        },
        classNames: {
          toast: 'group shadow-2xl font-medium tracking-normal text-slate-50',
          title: 'text-white font-semibold text-sm leading-snug',
          description: 'text-slate-300 text-xs mt-1 leading-relaxed',
          actionButton: 'bg-amber-500 text-black font-semibold rounded-lg text-xs px-3 py-1.5',
          cancelButton: 'bg-slate-800 text-slate-300 rounded-lg text-xs px-3 py-1.5',
          closeButton: '!bg-slate-800 !text-slate-300 hover:!text-white !border !border-slate-700 !top-3 !right-3',
          success: '!bg-[#071912] !text-emerald-100 !border-emerald-600/70',
          error: '!bg-[#22070b] !text-rose-100 !border-rose-600/70',
          warning: '!bg-[#221505] !text-amber-100 !border-amber-600/70',
          info: '!bg-[#09152a] !text-sky-100 !border-sky-600/70',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
