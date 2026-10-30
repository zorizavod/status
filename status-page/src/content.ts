export const SITE_FONT =
	'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';
export const BRAND = "#0F8E84";
export const INK = "#1F2024";

export interface Check {
	slug: string;
	name: string;
	note: string;
}

export const CHECKS: Check[] = [
	{
		slug: "mrp",
		name: "Программа в браузере",
		note: "Вход и экраны программы: заказы, склад, производство и закупки. При сбое программа не открывается.",
	},
	{
		slug: "api",
		name: "Загрузка и сохранение данных",
		note: "Программа открывается, но при сбое заказы и остатки не загружаются, а изменения не сохраняются.",
	},
	{
		slug: "database",
		name: "Хранилище данных",
		note: "Здесь лежат ваши заказы, остатки и спецификации. При сбое программа не покажет и не сохранит данные.",
	},
	{
		slug: "website",
		name: "Сайт zolotenkov.ru",
		note: "Описание программы, тарифы, блог и регистрация. При сбое не получится зарегистрироваться.",
	},
	{
		slug: "docs",
		name: "Справка",
		note: "Инструкции по работе в программе. При сбое инструкции не открываются, сама программа работает.",
	},
	{
		slug: "developer",
		name: "Портал разработчика",
		note: "Описание того, как подключить свою программу или ИИ-агента. При сбое описание не открывается.",
	},
	{
		slug: "external-api",
		name: "Подключение других программ и ИИ-агентов",
		note: "Через API и MCP ваша учетная система или ИИ-агент обменивается данными с Золотенков МРП.",
	},
];

export const HEADER_LINKS = [
	{ label: "Сайт", href: "https://zolotenkov.ru/" },
	{ label: "Войти в программу", href: "https://mrp.zolotenkov.ru/" },
	{ label: "Справка", href: "https://support.zolotenkov.ru/" },
	{ label: "Для разработчиков", href: "https://developer.zolotenkov.ru/" },
];

export const FOOTER_LINKS = [
	{ label: "Сайт", href: "https://zolotenkov.ru/" },
	{ label: "Справка", href: "https://support.zolotenkov.ru/" },
	{ label: "Для разработчиков", href: "https://developer.zolotenkov.ru/" },
	{ label: "Telegram", href: "https://t.me/zolotenkova_mrp" },
	{
		label: "svetlana@zolotenkov.ru",
		href: "mailto:svetlana@zolotenkov.ru",
	},
];
