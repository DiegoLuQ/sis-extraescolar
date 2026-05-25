import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateShort(date: string | Date): string {
  return new Date(date).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatRut(rut: string): string {
  const cleanRut = rut.replace(/[^0-9Kk]/g, '')
  if (cleanRut.length < 2) return rut
  
  const body = cleanRut.slice(0, -1)
  const dv = cleanRut.slice(-1)
  
  let formatted = ''
  let counter = 0
  
  for (let i = body.length - 1; i >= 0; i--) {
    formatted = body[i] + formatted
    counter++
    if (counter === 3 && i > 0) {
      formatted = '.' + formatted
      counter = 0
    }
  }
  
  return `${formatted}-${dv}`
}
