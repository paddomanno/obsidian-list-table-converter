import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

interface ListTableConvertPluginSettings {
	leaveHeaderEmpty: boolean;
	numberOfEmptyColumns: number;
}

const DEFAULT_SETTINGS: ListTableConvertPluginSettings = {
	leaveHeaderEmpty: true,
	numberOfEmptyColumns: 1,
};

export default class ListTableConvertPlugin extends Plugin {
	settings: ListTableConvertPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: "list-to-table-convert",
			name: "Convert list to table",
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				// only do stuff if we actually have a selection and only 1 selection
				if (
					!editor.somethingSelected() ||
					editor.getSelection().replace("\n", "").trim() == ""
				) {
					return;
				}
				if (editor.listSelections().length != 1) {
					return;
				}

				const posBefore = editor.getCursor();

				// extend selection to include the whole lines where anchor and head are
				const anchor = editor.listSelections()[0].anchor;
				const head = editor.listSelections()[0].head;
				if (anchor.line == head.line && anchor.ch == head.ch) {
					return;
				}
				if (anchor.line < head.line) {
					anchor.ch = 0;
					head.ch = editor.getLine(head.line).length;
				} else {
					head.ch = 0;
					anchor.ch = editor.getLine(anchor.line).length;
				}

				editor.setSelection(anchor, head);
				editor.replaceSelection(
					this.generateMarkdownTable(editor.getSelection())
				);
				editor.setCursor(posBefore.line, 2);
			},
		});
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	private generateMarkdownTable(inputString: string): string {
		let table = "";
		const listItems: string[] = this.parseListItems(inputString);

		if (listItems.length == 0) return "";

		// get longest item as it determines the width of the column
		const longestItem = listItems.reduce(function (a, b) {
			return a.length > b.length ? a : b;
		});

		// generate header row + hyphen row
		const widthFirstCol = longestItem.length;
		const widthSecondCol = 3;
		const columnWidths = [widthFirstCol].concat(
			Array(this.settings.numberOfEmptyColumns).fill(widthSecondCol)
		);
		if (this.settings.leaveHeaderEmpty) {
			table += this.generateHeaderRow(columnWidths, " ");
		} else {
			table += this.generateSingleRowWithContent(
				columnWidths,
				listItems[0]
			);
		}
		table += this.generateHeaderRow(columnWidths, "-");

		// generate the remaining content rows
		const remainingListItems = this.settings.leaveHeaderEmpty
			? listItems
			: listItems.slice(1);
		for (const item of remainingListItems) {
			table += this.generateSingleRowWithContent(columnWidths, item);
		}

		return table;
	}

	private parseListItems(inputString: string): string[] {
		let items = inputString.split("\n");

		// remove bullets / numbers / to-do brackets
		const startStrings = ["- [ ] ", "- [x] ", "- ", "* ", "+ ", "- "]; // check to-do boxes before checking the simple hyphen
		items = items.map((line, _, items) => {
			// numbered list?
			if (line.match(/^\d+\.\s/gm)) {
				return line.replace(/^\d+\.\s/gm, "");
			}

			// other kind of list?
			for (let str of startStrings) {
				if (line.startsWith(str)) {
					line = line.replace(str, "");
					// only remove the first finding so we don't remove actualy content by accident
					return line;
				}
			}

			return line;
		});

		// ignore empty lines until first text
		while (items.first()?.trim() == "") {
			items.shift();
		}

		// ignore empty lines at the end
		while (items.last()?.trim() == "") {
			items.pop();
		}

		return items;
	}

	private generateHeaderRow(colWidths: number[], char: string): string {
		let row = "";

		for (const colWidth of colWidths) {
			row += "| ";
			row += char.repeat(colWidth);
			row += " ";
		}
		row += "|\n";

		return row;
	}

	private generateSingleRowWithContent(
		colWidths: number[],
		text: string
	): string {
		let row = "";

		// first col gets text
		const colWidth = colWidths[0];
		row += "| ";
		row += text.padEnd(colWidth, " ");
		row += " ";

		// remaining cols empty
		for (let i = 1; i < colWidths.length; i++) {
			const colWidth = colWidths[i];
			row += "| ";
			row += " ".repeat(colWidth);
			row += " ";
		}

		row += "|\n";

		return row;
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: ListTableConvertPlugin;

	constructor(app: App, plugin: ListTableConvertPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Leave header row empty")
			.setDesc(
				"Leave the header row empty by putting the frist item in the second row?"
			)
			.addToggle((toggleComponent) =>
				toggleComponent
					.setValue(this.plugin.settings.leaveHeaderEmpty)
					.onChange(async (value) => {
						this.plugin.settings.leaveHeaderEmpty = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Number of added empty columns")
			.setDesc("How many empty columns should be added?")
			.addText((textfield) => {
				textfield.setPlaceholder(
					String(DEFAULT_SETTINGS.numberOfEmptyColumns)
				);
				textfield.inputEl.type = "number";
				textfield.setValue(
					String(this.plugin.settings.numberOfEmptyColumns)
				);
				textfield.onChange(async (value) => {
					if (value !== "") {
						this.plugin.settings.numberOfEmptyColumns =
							Number(value);
						await this.plugin.saveSettings();
					}
				});
			});
	}
}
