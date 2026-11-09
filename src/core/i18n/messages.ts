/**
 * Pesan issue dalam dua bahasa. Aturan linter hanya menyebut `messageId` + parameter;
 * teksnya dirakit di sini supaya menambah bahasa tidak perlu menyentuh aturan.
 */
export type Locale = 'id' | 'en'
export const LOCALES: Locale[] = ['id', 'en']
export const DEFAULT_LOCALE: Locale = 'id'

export type Params = Record<string, string | number>
export interface LocalizedText {
  message: string
  hint?: string
}
type MessageFn = (p: Params) => LocalizedText

const id: Record<string, MessageFn> = {
  CFG001: (p) => ({
    message: `Service "${p.service}" tidak punya image atau build.`,
    hint: 'Tambahkan image: nama:tag, atau blok build: yang menunjuk ke Dockerfile.',
  }),
  CFG002: () => ({
    message: 'Field "version" sudah usang dan diabaikan Docker Compose v2.',
    hint: 'Baris version bisa dihapus.',
  }),
  CFG003: (p) => ({
    message: `Port di "${p.service}" diabaikan karena network_mode: host.`,
    hint: 'Dengan network host, container langsung memakai port milik host. Hapus ports, atau ganti mode network.',
  }),
  PORT001: (p) => ({
    message: `Port host ${p.port}/${p.protocol} dipakai oleh "${p.a}" dan "${p.b}".`,
    hint: 'Hanya satu container yang bisa mengikat port host yang sama. Ganti salah satu port host.',
  }),
  'PORT001.same': (p) => ({
    message: `Port host ${p.port}/${p.protocol} dipakai dua kali oleh "${p.service}".`,
    hint: 'Hanya satu container yang bisa mengikat port host yang sama. Ganti salah satu port host.',
  }),
  NET001: (p) => ({
    message: `Subnet ${p.subnetA} (${p.netA}) tumpang tindih dengan ${p.subnetB} (${p.netB}).`,
    hint: 'Docker akan menolak membuat network kedua. Pilih rentang yang tidak beririsan.',
  }),
  NET002: (p) => ({
    message: `Network "${p.network}" dipakai "${p.service}" tapi tidak dideklarasikan.`,
    hint: `Tambahkan "${p.network}:" di bagian networks paling bawah.`,
  }),
  NET003: (p) => ({
    message: `IP ${p.ip} milik "${p.service}" berada di luar subnet ${p.subnets}.`,
    hint: 'Pilih IP di dalam rentang subnet network tersebut.',
  }),
  NET004: (p) => ({
    message: `IP ${p.ip} dipakai "${p.first}" dan "${p.second}" di network "${p.network}".`,
    hint: 'Setiap container butuh IP unik di network yang sama.',
  }),
  NET005: (p) => ({
    message: `Static IP butuh ipam.config.subnet di network "${p.network}".`,
    hint: `"${p.service}" memakai ipv4_address, tapi subnet network-nya dipilih otomatis oleh Docker.`,
  }),
  DEP001: (p) => ({
    message: `"${p.service}" bergantung pada "${p.dependency}", tapi service itu tidak ada.`,
    hint: 'Periksa ejaan nama service di depends_on.',
  }),
  DEP002: (p) => ({
    message: `Dependensi melingkar: ${p.cycle}.`,
    hint: 'Compose tidak bisa menentukan urutan start. Putus salah satu depends_on.',
  }),
  DEP003: (p) => ({
    message: `"${p.service}" menunggu "${p.dependency}" sehat, tapi "${p.dependency}" tidak punya healthcheck.`,
    hint: `Tambahkan healthcheck di "${p.dependency}", kecuali image-nya sudah punya HEALTHCHECK bawaan.`,
  }),
  VOL001: (p) => ({
    message: `Volume "${p.volume}" dipakai "${p.service}" tapi tidak dideklarasikan.`,
    hint: `Tambahkan "${p.volume}:" di bagian volumes paling bawah.`,
  }),
  VOL002: (p) => ({
    message: `Volume "${p.volume}" dideklarasikan tapi tidak dipakai service mana pun.`,
    hint: 'Hapus deklarasinya kalau memang tidak diperlukan.',
  }),
  'IMG001.latest': (p) => ({
    message: `Image "${p.image}" di "${p.service}" memakai tag latest; versi bisa berubah sewaktu-waktu.`,
    hint: `Tulis versi spesifik, misalnya ${p.name}:1.2.3.`,
  }),
  'IMG001.untagged': (p) => ({
    message: `Image "${p.image}" tanpa tag; versi bisa berubah sewaktu-waktu.`,
    hint: `Tulis versi spesifik, misalnya ${p.name}:1.2.3.`,
  }),
  SEC001: (p) => ({
    message: `${p.key} di "${p.service}" ditulis langsung di file.`,
    hint: `Pindahkan nilainya ke file .env dan tulis ${p.key}: \${${p.key}}.`,
  }),
  SEC002: (p) => ({
    message: `Port ${p.port} (${p.db}) "${p.service}" terbuka ke semua interface.`,
    hint: `Pertimbangkan 127.0.0.1:${p.published}:${p.port} bila hanya diakses dari host.`,
  }),
  VAR001: (p) => ({
    message: `\${${p.name}} belum punya nilai; aturan yang bergantung padanya dilewati.`,
    hint: 'Tanpa file .env nilainya tidak diketahui.',
  }),
  'YAML.syntax': (p) => ({
    message: `YAML tidak valid: ${p.detail}`,
    hint: 'Periksa indentasi dan tanda titik dua di sekitar baris ini.',
  }),
  'YAML.multiDoc': () => ({
    message: 'File berisi lebih dari satu dokumen YAML (---). Hanya dokumen pertama yang dipakai.',
  }),
  'YAML.notMapping': () => ({
    message: 'Root compose file harus berupa mapping (key: value).',
    hint: 'Mulai file dengan services: lalu definisikan service di bawahnya.',
  }),
}

const en: Record<string, MessageFn> = {
  CFG001: (p) => ({
    message: `Service "${p.service}" has no image or build.`,
    hint: 'Add image: name:tag, or a build: block that points to a Dockerfile.',
  }),
  CFG002: () => ({
    message: 'The "version" field is obsolete and ignored by Docker Compose v2.',
    hint: 'You can remove the version line.',
  }),
  CFG003: (p) => ({
    message: `Ports on "${p.service}" are ignored because of network_mode: host.`,
    hint: "With host networking the container uses the host's ports directly. Remove ports, or change the network mode.",
  }),
  PORT001: (p) => ({
    message: `Host port ${p.port}/${p.protocol} is used by "${p.a}" and "${p.b}".`,
    hint: 'Only one container can bind a given host port. Change one of the host ports.',
  }),
  'PORT001.same': (p) => ({
    message: `Host port ${p.port}/${p.protocol} is used twice by "${p.service}".`,
    hint: 'Only one container can bind a given host port. Change one of the host ports.',
  }),
  NET001: (p) => ({
    message: `Subnet ${p.subnetA} (${p.netA}) overlaps with ${p.subnetB} (${p.netB}).`,
    hint: "Docker will refuse to create the second network. Pick ranges that don't overlap.",
  }),
  NET002: (p) => ({
    message: `Network "${p.network}" is used by "${p.service}" but not declared.`,
    hint: `Add "${p.network}:" under the top-level networks section.`,
  }),
  NET003: (p) => ({
    message: `IP ${p.ip} of "${p.service}" is outside subnet ${p.subnets}.`,
    hint: "Pick an IP inside the network's subnet range.",
  }),
  NET004: (p) => ({
    message: `IP ${p.ip} is used by both "${p.first}" and "${p.second}" on network "${p.network}".`,
    hint: 'Each container needs a unique IP on the same network.',
  }),
  NET005: (p) => ({
    message: `Static IP requires ipam.config.subnet on network "${p.network}".`,
    hint: `"${p.service}" sets ipv4_address, but the network's subnet is picked automatically by Docker.`,
  }),
  DEP001: (p) => ({
    message: `"${p.service}" depends on "${p.dependency}", but that service does not exist.`,
    hint: 'Check the spelling of the service name in depends_on.',
  }),
  DEP002: (p) => ({
    message: `Circular dependency: ${p.cycle}.`,
    hint: 'Compose cannot determine a start order. Break one of the depends_on links.',
  }),
  DEP003: (p) => ({
    message: `"${p.service}" waits for "${p.dependency}" to be healthy, but "${p.dependency}" has no healthcheck.`,
    hint: `Add a healthcheck to "${p.dependency}", unless its image already has a built-in HEALTHCHECK.`,
  }),
  VOL001: (p) => ({
    message: `Volume "${p.volume}" is used by "${p.service}" but not declared.`,
    hint: `Add "${p.volume}:" under the top-level volumes section.`,
  }),
  VOL002: (p) => ({
    message: `Volume "${p.volume}" is declared but not used by any service.`,
    hint: "Remove the declaration if it isn't needed.",
  }),
  'IMG001.latest': (p) => ({
    message: `Image "${p.image}" in "${p.service}" uses the latest tag; the version can change at any time.`,
    hint: `Pin a specific version, for example ${p.name}:1.2.3.`,
  }),
  'IMG001.untagged': (p) => ({
    message: `Image "${p.image}" has no tag; the version can change at any time.`,
    hint: `Pin a specific version, for example ${p.name}:1.2.3.`,
  }),
  SEC001: (p) => ({
    message: `${p.key} in "${p.service}" is written directly in the file.`,
    hint: `Move the value to a .env file and write ${p.key}: \${${p.key}}.`,
  }),
  SEC002: (p) => ({
    message: `Port ${p.port} (${p.db}) of "${p.service}" is open on all interfaces.`,
    hint: `Consider 127.0.0.1:${p.published}:${p.port} if it is only accessed from the host.`,
  }),
  VAR001: (p) => ({
    message: `\${${p.name}} has no value; rules that depend on it are skipped.`,
    hint: 'Without a .env file its value is unknown.',
  }),
  'YAML.syntax': (p) => ({
    message: `Invalid YAML: ${p.detail}`,
    hint: 'Check the indentation and colons around this line.',
  }),
  'YAML.multiDoc': () => ({
    message: 'The file contains more than one YAML document (---). Only the first one is used.',
  }),
  'YAML.notMapping': () => ({
    message: 'The root of a compose file must be a mapping (key: value).',
    hint: 'Start the file with services: and define services under it.',
  }),
}

const catalogs: Record<Locale, Record<string, MessageFn>> = { id, en }

/** Rakit teks pesan; jatuh ke bahasa default bila kunci belum diterjemahkan. */
export function localize(locale: Locale, messageId: string, params: Params = {}): LocalizedText {
  const fn = catalogs[locale]?.[messageId] ?? catalogs[DEFAULT_LOCALE][messageId]
  if (!fn) return { message: messageId }
  const out = fn(params)
  return out.hint === undefined ? { message: out.message } : out
}

/** Semua messageId yang dikenal, untuk test kelengkapan terjemahan. */
export function messageIds(locale: Locale): string[] {
  return Object.keys(catalogs[locale])
}
