import clsx, { type ClassValue } from 'clsx';

// 元件的預設樣式有兩種：Button、Field、Dialog 這類用 index.css 的 @layer components（.sf-btn、.sf-field…），
// 頁面傳進來的 className（工具類）一定蓋得過；其他元件的預設樣式是直接寫的工具類，className 只能「加上」樣式，
// 要蓋掉同一個屬性的預設值不一定有效（兩個工具類誰贏取決於 Tailwind 產生的順序）。所以不用 tailwind-merge，
// 但要覆寫預設值前，先確認元件屬於哪一種；需要不同的外觀時加一個 prop（variant）。

export const cn = (...args: ClassValue[]) => clsx(args);
