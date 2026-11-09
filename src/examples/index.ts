import type { MessageKey } from '@/i18n'
import laravel from './laravel.yml?raw'
import microservices from './microservices.yml?raw'
import wordpress from './wordpress.yml?raw'

export interface Example {
  id: string
  labelKey: MessageKey
  yaml: string
}

export const examples: Example[] = [
  { id: 'laravel', labelKey: 'example.laravel', yaml: laravel },
  { id: 'micro', labelKey: 'example.micro', yaml: microservices },
  { id: 'wordpress', labelKey: 'example.wordpress', yaml: wordpress },
]
