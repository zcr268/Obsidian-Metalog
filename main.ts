import {App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile} from 'obsidian'

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
	timesViewed: string;
	recentlyRead: string;
	onceViewed: number;
	customize: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: '', timesViewed: 'timesViewed', recentlyRead: 'recentlyRead', onceViewed: 1, customize: '{}',
}

function log(e: any) {
	if ((window as any)._debug || true) {
		console.log(e)
	}
}

function dateFormat(date: Date, fmt: string) {  // author: meizz
	let o = {
		'M+': date.getMonth() + 1,  // 月份
		'd+': date.getDate(),  // 日
		'h+': date.getHours(),  // 小时
		'm+': date.getMinutes(),  // 分
		's+': date.getSeconds(),  // 秒
		'q+': Math.floor((date.getMonth() + 3) / 3),  // 季度
		'S' : date.getMilliseconds(),  // 毫秒
	}
	if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length))
	for (let k in o) if (new RegExp('(' + k + ')').test(fmt)) {
		// @ts-ignore
		fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)))
	}
	return fmt
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings

	async onload() {
		const _this = this
		await this.loadSettings()

		const app = this.app
		app.workspace.on('file-open', (file) => {
			log(file)
			if (file?.extension !== 'md') {
				return
			}
			let isExclude = false

			this.settings.mySetting.split(',').forEach(folder => {
				if (folder.trim() !== '' && file?.path.startsWith(folder.trim())) {
					isExclude = true
					return
				}
			})
			if (isExclude) {
				return
			}
			app.fileManager.processFrontMatter(file, (frontmatter) => {
				log(frontmatter)
				const key = _this.settings.timesViewed
				const recentlyReadKey = _this.settings.recentlyRead
				const count = frontmatter[key]
				const recentlyRead = frontmatter[recentlyReadKey]
				const now = dateFormat(new Date(), 'yyyy-MM-dd')
				if (!count || !recentlyRead) {
					frontmatter[key] = 1
					frontmatter[recentlyReadKey] = now
				} else {
					const nowNumber = Number(now.replace(/-/g, ''))
					const recordNumber = Number(recentlyRead.replace(/-/g, ''))
					const onceViewed = _this.settings.onceViewed
					if (nowNumber - recordNumber >= onceViewed) {
						log(`nowNumber:${nowNumber} - recordNumber${recordNumber} >= onceViewed:${onceViewed}`)
						frontmatter[key] += 1
						frontmatter[recentlyReadKey] = now
					}
				}
				const customize = JSON.parse(String(this.settings.customize ?? '{}'))
				const keys = Object.keys(customize)
				for (const key of keys) {
					if (frontmatter[key] == undefined) {
						frontmatter[key] = customize[key]
					}
				}
			})
		})

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem()
		statusBarItemEl.setText('Metalogging')

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this))

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app)
	}

	onOpen() {
		const {contentEl} = this
		contentEl.setText('Woah!')
	}

	onClose() {
		const {contentEl} = this
		contentEl.empty()
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const {containerEl} = this

		containerEl.empty()

		containerEl.createEl('h2', {text: 'Settings for Metalog.'})

		new Setting(containerEl)
			.setName('排除的文件')
			.setDesc('不想记录的文件名，用逗号分隔')
			.addText(text => text
				.setPlaceholder('e.g. DailyNotes, Readwise/Articles')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					log('Secret: ' + value)
					this.plugin.settings.mySetting = value
					await this.plugin.saveSettings()
				}))

		new Setting(containerEl)
			.setName('timesViewed name')
			.setDesc('自定义阅读次数的名称')
			.addText(text => text
				.setPlaceholder('e.g. review count')
				.setValue(this.plugin.settings.timesViewed)
				.onChange(async (value) => {
					log('Secret: ' + value)
					this.plugin.settings.timesViewed = value || DEFAULT_SETTINGS.timesViewed
					await this.plugin.saveSettings()
				}))
		new Setting(containerEl)
			.setName('recentlyRead name')
			.setDesc('自定义最近阅读日期字段的名称')
			.addText(text => text
				.setPlaceholder('e.g. recentlyRead')
				.setValue(this.plugin.settings.recentlyRead)
				.onChange(async (value) => {
					log('Secret: ' + value)
					this.plugin.settings.recentlyRead = value || DEFAULT_SETTINGS.recentlyRead
					await this.plugin.saveSettings()
				}))
		new Setting(containerEl)
			.setName('onceViewed day')
			.setDesc('一次阅读间隔多久才加一次（单位天）')
			.addText(text => text
				.setPlaceholder('e.g. 1')
				.setValue(String(this.plugin.settings.onceViewed))
				.onChange(async (value) => {
					log('Secret: ' + value)
					this.plugin.settings.onceViewed = Number(value || DEFAULT_SETTINGS.onceViewed)
					await this.plugin.saveSettings()
				}))

		const customize = JSON.parse(String(this.plugin.settings.customize ?? '{}'))
		const keys = Object.keys(customize)
		const plugin = this.plugin

		function newKV(oldKey = '', oldValue = '') {
			let key_str = oldKey
			let value_str = oldValue
			let pre_key = key_str

			async function saveSettings() {
				if (key_str != '' && value_str != '') {
					const customize = JSON.parse(String(plugin.settings.customize ?? '{}'))
					customize[key_str] = value_str
					if (pre_key != '' && pre_key != key_str) {
						delete customize[pre_key]
						pre_key = key_str
					}
					plugin.settings.customize = JSON.stringify(customize)
					await plugin.saveSettings()
				}
			}

			const customizeKV = new Setting(containerEl).addText(key => {
				key.setPlaceholder('key').onChange(async value => {
					key_str = value
					await saveSettings()
				})
				if (oldKey != '') {
					key.setValue(oldKey)
				}
			}).addText(value => {
				value.setPlaceholder('value').onChange(async value => {
					value_str = value
					await saveSettings()
				})
				if (oldValue != '') {
					value.setValue(oldValue)
				}
			})
			customizeKV.addButton(component => {
				component.onClick(async () => {
					customizeKV.controlEl.parentElement?.removeChild(customizeKV.controlEl)
					const customize = JSON.parse(String(plugin.settings.customize ?? '{}'))
					if (customize[key_str] != undefined) {
						delete customize[key_str]
					}
					if (customize[pre_key] != undefined) {
						delete customize[pre_key]
					}
					plugin.settings.customize = JSON.stringify(customize)
					await plugin.saveSettings()
				}).setButtonText('删除')
			})
		}

		new Setting(containerEl)
			.setName('自定义的默认添加字段')
			.addButton(component => {
			component.onClick(() => {
				newKV()
			}).setButtonText('添加')
		})

		for (const key of keys) {
			newKV(key, customize[key])
		}
	}
}
