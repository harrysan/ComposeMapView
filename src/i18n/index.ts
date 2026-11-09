import { ref, watch } from 'vue'
import { LOCALES } from '@/core/i18n/messages'
import type { Locale } from '@/core/i18n/messages'

export type { Locale }
export { LOCALES }

const STORAGE_KEY = 'composemapview.locale'

const id = {
  'app.tagline': 'Visualizer & linter docker-compose',
  'header.examples': 'Contoh',
  'header.openFile': 'Buka file',
  'header.share': 'Bagikan',
  'header.local': 'Diproses di browser, tidak diunggah',
  'header.localTitle':
    'Semua analisis berjalan di browser kamu. File tidak dikirim ke server mana pun.',
  'header.language': 'Bahasa',
  'header.theme': 'Tema',
  'theme.system': 'Ikuti sistem',
  'theme.light': 'Terang',
  'theme.dark': 'Gelap',
  'example.laravel': 'Laravel + MySQL + Redis',
  'example.micro': 'Microservices (banyak masalah)',
  'example.wordpress': 'WordPress (bersih)',

  'tabs.label': 'Panel',
  'tabs.editor': 'Editor',
  'tabs.diagram': 'Diagram',
  'tabs.issues': 'Masalah',

  'editor.label': 'Editor YAML',
  'editor.aria': 'Isi docker-compose.yml',
  'editor.valid': 'YAML valid',
  'editor.invalid': 'YAML tidak valid',
  'editor.collapse': 'Ciutkan editor',
  'editor.expand': 'Tampilkan editor',

  'diagram.title': 'Diagram',
  'diagram.aria': 'Diagram service, network, dan volume',
  'diagram.services': 'service',
  'diagram.networks': 'network',
  'diagram.volumes': 'volume',
  'diagram.ports': 'Port',
  'diagram.volumeToggle': 'Volume',
  'diagram.stale': 'YAML tidak valid{line}. Diagram menampilkan versi terakhir yang valid.',
  'diagram.staleLine': ' di baris {line}',
  'diagram.legendNetwork': 'Network',
  'diagram.legendVolume': 'Named volume',
  'diagram.legendHint': 'Scroll untuk zoom, seret untuk geser',
  'diagram.dropHere': 'Lepaskan file untuk membukanya',
  'diagram.detailCollapse': 'Ciutkan panel detail',
  'diagram.detailExpand': 'Tampilkan panel detail',

  'empty.title': 'Belum ada yang bisa digambar',
  'empty.noText':
    'Tempel isi docker-compose.yml di editor, seret file ke sini, atau coba salah satu contoh.',
  'empty.noServices':
    'File ini belum punya bagian services. Tambahkan services: lalu definisikan minimal satu service.',
  'empty.invalidFirst':
    'YAML belum valid, jadi diagram belum bisa digambar. Lihat daftar masalah di bawah.',
  'empty.tryExample': 'Coba contoh',

  'detail.aria': 'Detail',
  'detail.project': 'Proyek',
  'detail.unnamed': 'Tanpa nama',
  'detail.summary': 'Ringkasan pemeriksaan',
  'detail.howToRead': 'Cara membaca',
  'detail.howToRead1':
    'Service tersusun dari kiri ke kanan mengikuti depends_on: service di kiri menunggu service di kanannya.',
  'detail.howToRead2':
    'Network ada di baris atas, named volume di baris bawah. Klik node mana saja untuk melihat detail dan hubungannya.',
  'detail.service': 'Service',
  'detail.network': 'Network',
  'detail.volume': 'Named volume',
  'detail.noImage': 'tanpa image',
  'detail.profile': 'Profile',
  'detail.issues': 'Masalah',
  'detail.ports': 'Port',
  'detail.portRandom': 'acak',
  'detail.hostNetwork': 'Memakai network host',
  'detail.notPublished': 'Tidak dipublish ke host',
  'detail.networks': 'Network',
  'detail.alias': 'alias',
  'detail.mounts': 'Volume & bind mount',
  'detail.anonymous': '(anonim)',
  'detail.dependsOn': 'Bergantung pada',
  'detail.dependents': 'Ditunggu oleh',
  'detail.environment': 'Environment',
  'detail.fromShell': '(dari shell)',
  'detail.healthcheck': 'Healthcheck',
  'detail.healthFromImage': '(test dari image)',
  'detail.disabled': 'Dinonaktifkan',
  'detail.none': 'Tidak ada',
  'detail.goto': 'Lihat di editor, baris {line} →',
  'detail.autoNetwork': 'Dibuat otomatis oleh Compose',
  'detail.undeclared': 'Tidak dideklarasikan',
  'detail.external': 'External, dibuat di luar file ini',
  'detail.externalShort': 'External',
  'detail.driver': 'Driver {driver}',
  'detail.subnet': 'Subnet',
  'detail.autoSubnet': 'Dipilih otomatis oleh Docker',
  'detail.members': 'Anggota',
  'detail.usedBy': 'Dipakai oleh',
  'condition.service_started': 'started',
  'condition.service_healthy': 'healthy',
  'condition.service_completed_successfully': 'selesai',

  'issues.title': 'Masalah',
  'issues.filter': 'Filter severity',
  'issues.collapse': 'Ciutkan panel masalah',
  'issues.expand': 'Tampilkan panel masalah',
  'issues.all': 'Semua',
  'issues.allClear': 'Tidak ada masalah yang terdeteksi. File ini siap dijalankan.',
  'issues.noneForFilter': 'Tidak ada masalah dengan tingkat ini.',
  'issues.empty': 'Belum ada isi untuk diperiksa.',
  'issues.line': 'baris {line}',
  'severity.error': 'Error',
  'severity.warning': 'Warning',
  'severity.info': 'Info',

  'share.title': 'Bagikan diagram',
  'share.desc':
    'Isi YAML dikompres dan disimpan di bagian # URL. Bagian ini tidak pernah dikirim ke server; siapa pun yang membuka link akan melihat diagram yang sama.',
  'share.copy': 'Salin link',
  'share.copied': 'Tersalin!',
  'share.copyFailed': 'Gagal menyalin otomatis. Pilih teks link lalu salin manual.',
  'share.close': 'Tutup',
  'share.length': '{n} karakter',
  'share.tooLong':
    'Link ini sangat panjang (lebih dari {max} karakter). Beberapa aplikasi chat bisa memotongnya.',
  'share.secrets':
    'File ini berisi {n} nilai rahasia yang ditulis langsung (SEC001). Siapa pun yang punya link bisa membacanya.',
  'share.secretsConfirm': 'Saya paham, tetap bagikan',
  'share.empty': 'Editor masih kosong; tidak ada yang bisa dibagikan.',

  'load.sharedOk': 'Diagram dibuka dari link share.',
  'load.sharedBroken':
    'Link share rusak atau terpotong, jadi isinya tidak bisa dibaca. Contoh bawaan ditampilkan.',
  'load.fileTooLarge': 'File "{name}" terlalu besar ({size}). Batasnya {max}.',
  'load.fileNotText': 'File "{name}" bukan file teks YAML.',
  'load.fileOpened': 'File "{name}" dibuka.',
  'toast.dismiss': 'Tutup pemberitahuan',
}

export type MessageKey = keyof typeof id

const en: Record<MessageKey, string> = {
  'app.tagline': 'docker-compose visualizer & linter',
  'header.examples': 'Examples',
  'header.openFile': 'Open file',
  'header.share': 'Share',
  'header.local': 'Processed in your browser, never uploaded',
  'header.localTitle': 'All analysis runs in your browser. The file is never sent to any server.',
  'header.language': 'Language',
  'header.theme': 'Theme',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'example.laravel': 'Laravel + MySQL + Redis',
  'example.micro': 'Microservices (many issues)',
  'example.wordpress': 'WordPress (clean)',

  'tabs.label': 'Panels',
  'tabs.editor': 'Editor',
  'tabs.diagram': 'Diagram',
  'tabs.issues': 'Issues',

  'editor.label': 'YAML editor',
  'editor.aria': 'docker-compose.yml contents',
  'editor.valid': 'Valid YAML',
  'editor.invalid': 'Invalid YAML',
  'editor.collapse': 'Collapse editor',
  'editor.expand': 'Show editor',

  'diagram.title': 'Diagram',
  'diagram.aria': 'Diagram of services, networks, and volumes',
  'diagram.services': 'services',
  'diagram.networks': 'networks',
  'diagram.volumes': 'volumes',
  'diagram.ports': 'Ports',
  'diagram.volumeToggle': 'Volumes',
  'diagram.stale': 'Invalid YAML{line}. The diagram shows the last valid version.',
  'diagram.staleLine': ' on line {line}',
  'diagram.legendNetwork': 'Network',
  'diagram.legendVolume': 'Named volume',
  'diagram.legendHint': 'Scroll to zoom, drag to pan',
  'diagram.dropHere': 'Drop the file to open it',
  'diagram.detailCollapse': 'Collapse details panel',
  'diagram.detailExpand': 'Show details panel',

  'empty.title': 'Nothing to draw yet',
  'empty.noText':
    'Paste a docker-compose.yml into the editor, drop a file here, or try one of the examples.',
  'empty.noServices':
    'This file has no services section yet. Add services: and define at least one service.',
  'empty.invalidFirst':
    "The YAML isn't valid yet, so the diagram can't be drawn. See the issues below.",
  'empty.tryExample': 'Try an example',

  'detail.aria': 'Details',
  'detail.project': 'Project',
  'detail.unnamed': 'Unnamed',
  'detail.summary': 'Check summary',
  'detail.howToRead': 'How to read it',
  'detail.howToRead1':
    'Services flow left to right following depends_on: a service on the left waits for the ones to its right.',
  'detail.howToRead2':
    'Networks are on the top row, named volumes on the bottom row. Click any node to see its details and connections.',
  'detail.service': 'Service',
  'detail.network': 'Network',
  'detail.volume': 'Named volume',
  'detail.noImage': 'no image',
  'detail.profile': 'Profile',
  'detail.issues': 'Issues',
  'detail.ports': 'Ports',
  'detail.portRandom': 'random',
  'detail.hostNetwork': 'Uses the host network',
  'detail.notPublished': 'Not published to the host',
  'detail.networks': 'Networks',
  'detail.alias': 'alias',
  'detail.mounts': 'Volumes & bind mounts',
  'detail.anonymous': '(anonymous)',
  'detail.dependsOn': 'Depends on',
  'detail.dependents': 'Waited on by',
  'detail.environment': 'Environment',
  'detail.fromShell': '(from shell)',
  'detail.healthcheck': 'Healthcheck',
  'detail.healthFromImage': '(test from image)',
  'detail.disabled': 'Disabled',
  'detail.none': 'None',
  'detail.goto': 'Show in editor, line {line} →',
  'detail.autoNetwork': 'Created automatically by Compose',
  'detail.undeclared': 'Not declared',
  'detail.external': 'External, created outside this file',
  'detail.externalShort': 'External',
  'detail.driver': 'Driver {driver}',
  'detail.subnet': 'Subnet',
  'detail.autoSubnet': 'Picked automatically by Docker',
  'detail.members': 'Members',
  'detail.usedBy': 'Used by',
  'condition.service_started': 'started',
  'condition.service_healthy': 'healthy',
  'condition.service_completed_successfully': 'completed',

  'issues.title': 'Issues',
  'issues.filter': 'Severity filter',
  'issues.collapse': 'Collapse issues panel',
  'issues.expand': 'Show issues panel',
  'issues.all': 'All',
  'issues.allClear': 'No issues found. This file is ready to run.',
  'issues.noneForFilter': 'No issues at this level.',
  'issues.empty': 'Nothing to check yet.',
  'issues.line': 'line {line}',
  'severity.error': 'Error',
  'severity.warning': 'Warning',
  'severity.info': 'Info',

  'share.title': 'Share diagram',
  'share.desc':
    'The YAML is compressed into the # part of the URL. That part is never sent to a server; anyone who opens the link sees the same diagram.',
  'share.copy': 'Copy link',
  'share.copied': 'Copied!',
  'share.copyFailed': "Couldn't copy automatically. Select the link text and copy it manually.",
  'share.close': 'Close',
  'share.length': '{n} characters',
  'share.tooLong': 'This link is very long (over {max} characters). Some chat apps may cut it off.',
  'share.secrets':
    'This file contains {n} secret value(s) written in plain text (SEC001). Anyone with the link can read them.',
  'share.secretsConfirm': 'I understand, share anyway',
  'share.empty': 'The editor is empty; there is nothing to share.',

  'load.sharedOk': 'Diagram opened from a share link.',
  'load.sharedBroken':
    'The share link is broken or truncated, so it could not be read. Showing the default example.',
  'load.fileTooLarge': 'File "{name}" is too large ({size}). The limit is {max}.',
  'load.fileNotText': 'File "{name}" is not a YAML text file.',
  'load.fileOpened': 'Opened "{name}".',
  'toast.dismiss': 'Dismiss notification',
}

const catalogs: Record<Locale, Record<MessageKey, string>> = { id, en }

function readStored(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'id' || v === 'en' ? v : null
  } catch {
    return null
  }
}

function detect(): Locale {
  const stored = readStored()
  if (stored) return stored
  const lang = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'id'
  return lang.startsWith('id') || lang.startsWith('ms') ? 'id' : 'en'
}

/** Bahasa aktif (global, reaktif). */
export const locale = ref<Locale>(detect())

watch(
  locale,
  (l) => {
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      // Penyimpanan diblokir: pilihan tetap berlaku untuk sesi ini.
    }
    if (typeof document !== 'undefined') document.documentElement.lang = l
  },
  { immediate: true },
)

export function translate(
  l: Locale,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  const template = catalogs[l][key] ?? catalogs.id[key] ?? key
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    params[name] !== undefined ? String(params[name]) : m,
  )
}

/** Terjemahkan untuk bahasa aktif. Reaktif bila dipanggil di template/computed. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(locale.value, key, params)
}

export function useI18n() {
  return { locale, t, translate }
}

/** Untuk test kelengkapan terjemahan. */
export function catalogKeys(l: Locale): string[] {
  return Object.keys(catalogs[l])
}
