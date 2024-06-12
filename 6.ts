import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import xlsx from "xlsx";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

interface KeywordData {
    variations: string[];
    useStock?: number;
    code: string;
    saleStatus: string;
}

// 엑셀 파일 읽기
const workbook = xlsx.readFile(path.join(__dirname, "keywords.xlsx"));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// 엑셀 데이터를 키워드 객체로 변환
const keywordsData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
const keywords: { [key: string]: { [key: string]: KeywordData } } = {};
keywordsData.forEach((row: any) => {
    const category = row[0];
    const keyword = row[1];
    const variations = row[2] ? row[2].split(",").map((item: string) => item.trim()) : [];
    const useStock = row[3] !== undefined ? parseInt(row[3]) : undefined;
    const code = row[4];
    const saleStatus = row[5];

    if (!keywords[category]) {
        keywords[category] = {};
    }

    keywords[category][keyword] = { variations, code, saleStatus };
    if (category !== "menu" && useStock !== undefined) {
        keywords[category][keyword].useStock = useStock;
    }
});

// 옵션들을 길이별로 정렬
const sortedKeywords = (keywordsObj: { [key: string]: KeywordData }) =>
    Object.entries(keywordsObj)
        .sort(([keyA], [keyB]) => keyB.length - keyA.length)
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {} as typeof keywordsObj);

// 키워드 객체
const menuKeywords = sortedKeywords(keywords["menu"]);
const temperatureKeywords = sortedKeywords(keywords["temperature"]);
const sizeKeywords = sortedKeywords(keywords["size"]);
const coffeeBeanKeywords = sortedKeywords(keywords["coffeeBean"]);
const caffeinLevelKeywords = sortedKeywords(keywords["caffeinLevel"]);
const syrupKeywords = sortedKeywords(keywords["syrup"]);
const powderKeywords = sortedKeywords(keywords["powder"]);
const drizzleKeywords = sortedKeywords(keywords["drizzle"]);
const whippingKeywords = sortedKeywords(keywords["whipping"]);
const milkKeywords = sortedKeywords(keywords["milk"]);
const toppingKeywords = sortedKeywords(keywords["topping"]);
const amountKeywords = sortedKeywords(keywords["amount"]);
const quantityKeywords = sortedKeywords(keywords["quantity"]);

const cancelKeywords = {
    cancleSyrup: sortedKeywords(keywords["cancleSyrup"]),
    canclePowder: sortedKeywords(keywords["canclePowder"]),
    cancleDrizzle: sortedKeywords(keywords["cancleDrizzle"]),
    cancleWhipping: sortedKeywords(keywords["cancleWhipping"]),
    cancleMilk: sortedKeywords(keywords["cancleMilk"]),
    cancleTopping: sortedKeywords(keywords["cancleTopping"]),
    cancleMenu: sortedKeywords(keywords["cancleMenu"]),
};

let menuOrder: { [key: string]: string } = {
    menu: "",
    temperature: "",
    size: "",
    coffeeBean: "",
    syrup: "",
    powder: "",
    drizzle: "",
    caffeinLevel: "",
    whippingCream: "",
    milk: "",
    topping: "",
    quantity: "",
};

/**
 * 두 문자열 사이의 Levenshtein 거리를 계산합니다.
 * Levenshte인 거리는 한 문자열을 다른 문자열로 변경하는 데 필요한
 * 최소 편집 연산(삽입, 삭제, 대체)의 수를 의미합니다.
 *
 * @param s - 첫 번째 문자열.
 * @param t - 두 번째 문자열.
 * @returns 두 문자열 사이의 Levenshte인 거리.
 */
function levenshteinDistance(s: string, t: string) {
    const n: number = s.length;
    const m: number = t.length;
    const d: number[][] = Array.from(Array(n + 1), () => Array(m + 1).fill(0));

    if (n === 0) return m;
    if (m === 0) return n;

    for (let i = 0; i <= n; i++) d[i][0] = i;
    for (let j = 0; j <= m; j++) d[0][j] = j;

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        }
    }

    return d[n][m];
}

/**
 * Levenshte인 거리를 사용하여 두 문자열을 비교하고 0과 1 사이의 유사도 점수를 반환합니다.
 * 점수는 (maxLen - distance) / maxLen으로 계산되며, 여기서 maxLen은 더 긴 문자열의 길이입니다.
 *
 * @param string1 - 첫 번째 문자열.
 * @param string2 - 두 번째 문자열.
 * @returns 두 문자열 사이의 유사도 점수.
 */
function compareTwoStrings(string1: string, string2: string) {
    const distance = levenshteinDistance(string1.toLowerCase(), string2.toLowerCase());
    const maxLen = Math.max(string1.length, string2.length);
    return (maxLen - distance) / maxLen;
}

/**
 * 주어진 텍스트에서 키워드를 찾아 반환합니다.
 *
 * @param inputText - 입력 텍스트.
 * @param keywords - 키워드 객체.
 * @returns 발견된 키워드.
 */
function findKeyword(inputText: string, keywords: { [key: string]: KeywordData }): string {
    for (const [keyword, { variations }] of Object.entries(keywords)) {
        const allVariations = [keyword, ...variations];
        for (const variation of allVariations) {
            for (let i = 0; i <= inputText.length - variation.length; i++) {
                const substring = inputText.slice(i, i + variation.length);
                const similarity = compareTwoStrings(substring, variation);
                if (similarity >= 0.7) {
                    return keyword; // 유사도가 0.7 이상인 첫 번째 키워드 발견 시 반환
                }
            }
        }
    }
    return ""; // 유사도가 0.7 이상인 키워드를 찾지 못한 경우 빈 문자열 반환
}

/**
 * 주어진 텍스트에서 취소 키워드를 찾아 반환합니다.
 *
 * @param inputText - 입력 텍스트.
 * @param cancelKeywords - 취소 키워드 객체.
 * @returns 발견된 취소 키워드.
 */
function findCancelKeyword(inputText: string, cancelKeywords: { [key: string]: KeywordData }): string {
    for (const [keyword, { variations }] of Object.entries(cancelKeywords)) {
        const allVariations = [keyword, ...variations];
        for (const variation of allVariations) {
            for (let i = 0; i <= inputText.length - variation.length; i++) {
                const substring = inputText.slice(i, i + variation.length);
                const similarity = compareTwoStrings(substring, variation);
                if (similarity >= 0.7) {
                    return keyword; // 유사도가 0.7 이상인 첫 번째 취소 키워드 발견 시 반환
                }
            }
        }
    }
    return ""; // 유사도가 0.7 이상인 취소 키워드를 찾지 못한 경우 빈 문자열 반환
}

function findKeywords(inputText: string): { [key: string]: string } {
    const newOrder: { [key: string]: string } = {
        menu: findKeyword(inputText, menuKeywords),
        temperature: findKeyword(inputText, temperatureKeywords),
        size: findKeyword(inputText, sizeKeywords),
        coffeeBean: findKeyword(inputText, coffeeBeanKeywords),
        caffeinLevel: findKeyword(inputText, caffeinLevelKeywords),
        syrup: findKeyword(inputText, syrupKeywords),
        powder: findKeyword(inputText, powderKeywords),
        drizzle: findKeyword(inputText, drizzleKeywords),
        whipping: findKeyword(inputText, whippingKeywords),
        milk: findKeyword(inputText, milkKeywords),
        topping: findKeyword(inputText, toppingKeywords),
        quantity: findKeyword(inputText, quantityKeywords) || '1'
    };

    // 취소 키워드 처리
    const cancelOrder: { [key: string]: string } = {
        cancleSyrup: findCancelKeyword(inputText, cancelKeywords["cancleSyrup"]),
        canclePowder: findCancelKeyword(inputText, cancelKeywords["canclePowder"]),
        cancleDrizzle: findCancelKeyword(inputText, cancelKeywords["cancleDrizzle"]),
        cancleWhipping: findCancelKeyword(inputText, cancelKeywords["cancleWhipping"]),
        cancleMilk: findCancelKeyword(inputText, cancelKeywords["cancleMilk"]),
        cancleTopping: findCancelKeyword(inputText, cancelKeywords["cancleTopping"]),
        cancleMenu: findCancelKeyword(inputText, cancelKeywords["cancleMenu"]),
    };

    // 기존 주문과 새로운 주문을 병합하여 누적시킴
    for (const key in newOrder) {
        if (newOrder[key]) {
            menuOrder[key] = newOrder[key];
        }
    }

    // 취소 키워드가 있는 경우 해당 옵션을 빈 문자열로 설정
    for (const key in cancelOrder) {
        if (cancelOrder[key]) {
            const option = key.replace("cancle", "").toLowerCase();
            if (menuOrder[option]) {
                menuOrder[option] = "";
            }
        }
    }

    return menuOrder;
}

console.time("findKeywords");
console.log(findKeywords("뜨거운 디카페인아메리카노 바닐라시럽추가 줘 시럽취소해줘"));
console.timeEnd("findKeywords");
