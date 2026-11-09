import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'

import { mount } from '@vue/test-utils'
import App from '@/App.vue'
import { locale } from '@/i18n'

// Editor dan diagram butuh layout DOM nyata (tidak tersedia di jsdom); cukup diganti stub.
vi.mock('@/components/YamlEditor.vue', () => ({
  default: { template: '<div class="editor-stub" />' },
}))
vi.mock('@/components/DiagramView.vue', () => ({
  default: { template: '<div class="diagram-stub" />' },
}))

describe('App', () => {
  it('menampilkan nama aplikasi, contoh, dan daftar masalah (ID)', async () => {
    locale.value = 'id'
    const wrapper = mount(App)
    await nextTick()
    expect(wrapper.text()).toContain('ComposeMapView')
    expect(wrapper.findAll('#example option').length).toBeGreaterThanOrEqual(3)
    expect(wrapper.text()).toContain('Masalah')
    expect(wrapper.text()).toContain('Diproses di browser')
    wrapper.unmount()
  })

  it('tombol EN mengganti UI dan pesan issue ke bahasa Inggris', async () => {
    locale.value = 'id'
    const wrapper = mount(App)
    await nextTick()
    const en = wrapper.findAll('.seg button').find((b) => b.text() === 'EN')!
    await en.trigger('click')
    await nextTick()
    expect(locale.value).toBe('en')
    expect(wrapper.text()).toContain('Issues')
    expect(wrapper.text()).toContain('Processed in your browser')
    // Contoh Laravel punya SEC001 untuk DB_PASSWORD.
    expect(wrapper.text()).toContain('is written directly in the file')
    expect(document.documentElement.lang).toBe('en')
    wrapper.unmount()
    locale.value = 'id'
  })

  it('panel detail bisa diciutkan dan dibuka lagi', async () => {
    const wrapper = mount(App)
    await nextTick()
    const toggle = wrapper.find('[aria-controls="detail-panel"]')
    expect(wrapper.find('#detail-panel').isVisible()).toBe(true)
    await toggle.trigger('click')
    expect(wrapper.find('#detail-panel').attributes('style')).toContain('display: none')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(wrapper.find('#detail-panel').attributes('style') ?? '').not.toContain('display: none')
    wrapper.unmount()
  })

  it('panel masalah di bawah bisa diciutkan dan dibuka lagi', async () => {
    const wrapper = mount(App)
    await nextTick()
    const toggle = wrapper.find('[aria-controls="issue-list"]')
    const layout = wrapper.find('main.layout')
    expect(layout.classes()).not.toContain('issues-collapsed')
    await toggle.trigger('click')
    expect(layout.classes()).toContain('issues-collapsed')
    expect(wrapper.find('#issue-list').attributes('style')).toContain('display: none')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    // Judul dan filter tetap terlihat saat diciutkan.
    expect(wrapper.find('.issues-pane .filters').exists()).toBe(true)
    await toggle.trigger('click')
    expect(layout.classes()).not.toContain('issues-collapsed')
    wrapper.unmount()
  })
})
