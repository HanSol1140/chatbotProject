import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import xlsx from "xlsx";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// 엑셀 파일 읽기
const workbook = xlsx.readFile(path.join(__dirname, "keywords.xlsx"));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// 엑셀 데이터를 키워드 객체로 변환
const keywordsData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
const keywords: { [key: string]: { [key: string]: { variations: string[], stock: number | null } } } = {};
keywordsData.forEach((row: any) => {
    const category = row[0];
    const keyword = row[1];
    const variations = row[2] ? row[2].split(",").map((item: string) => item.trim()) : [];
    const stock = row[3] === "null" ? Infinity : parseInt(row[3]);

    if (!keywords[category]) {
        keywords[category] = {};
    }

    keywords[category][keyword] = { variations, stock };
});

// console.log(keywords);
// 옵션들을 길이별로 정렬 문자열 길이로 내림차순 => 오름차순은 키워드가 중복될 위험이 있음
const sortedKeywords = (keywordsObj: { [key: string]: { variations: string[], stock: number | null } }) => {
  if (!keywordsObj) return {};
  return Object.entries(keywordsObj)
      .sort(([keyA], [keyB]) => keyB.length - keyA.length)
      .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
      }, {} as typeof keywordsObj);
};
// 키워드 객체
const menuKeywords = sortedKeywords(keywords["menu"]);
const temperatureKeywords = sortedKeywords(keywords["temperature"]);
const sizeKeywords = sortedKeywords(keywords["size"]);
const coffeeBeanKeywords = sortedKeywords(keywords["coffeeBean"]);
const caffeinLevelKeywords = sortedKeywords(keywords["caffeinLevel"]);
const syrupKeywords = sortedKeywords(keywords["syrup"]);
const powderKeywords = sortedKeywords(keywords["powder"]);
const drizzleKeywords = sortedKeywords(keywords["drizzle"]);
const whippingKeywords = sortedKeywords(keywords["whippingCream"]);
const milkKeywords = sortedKeywords(keywords["milk"]);
const toppingKeywords = sortedKeywords(keywords["topping"]);
const amountKeywords = sortedKeywords(keywords["amount"]);
const quantityKeywords = sortedKeywords(keywords["quantity"]);
console.log(menuKeywords);
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

// Levenshtein 거리 계산 함수
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

// 문자열 유사도 계산 함수
function compareTwoStrings(string1: string, string2: string) {
    const distance = levenshteinDistance(string1.toLowerCase(), string2.toLowerCase());
    const maxLen = Math.max(string1.length, string2.length);
    return (maxLen - distance) / maxLen;
}

// 키워드 찾기 함수
function findKeyword(inputText: string, keywords: { [key: string]: { variations: string[], stock: number | null } }): string {
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

// 취소 키워드 찾기 함수
function findCancelKeyword(inputText: string, cancelKeywords: { [key: string]: { variations: string[], stock: number | null } }): string {
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
console.log(findKeywords("뜨거운 디카페인아메리카노 바닐라시럽추가 줘"));
console.log(findKeywords("사이즈는 톨로 줘"));
console.timeEnd("findKeywords");
