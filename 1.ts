import express from "express";
import path from 'path';
import fs from "fs";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(__dirname));

// ==============================================================================
// 먼저, levenshteinDistance 함수는 두 문자열 사이의 Levenshtein 거리(편집 거리)를 계산
// 이 거리는 한 문자열을 다른 문자열로 변환하는 데 필요한 편집 연산(삽입, 삭제, 대체)의 최소 수를 의미
function levenshteinDistance(s: any, t: any) {
    const n: number = s.length; // 첫 번째 문자열의 길이
    const m: number = t.length; // 두 번째 문자열의 길이
    const d: any = []; // 거리 행렬

    // 한 문자열이 비어있는 경우, 다른 문자열의 길이가 편집 거리
    if (n === 0) return m;
    if (m === 0) return n;

    // 첫 번째 문자열의 각 문자를 기준으로 초기화
    for (let i = 0; i <= n; i++) d[i] = [i];
    // 두 번째 문자열의 각 문자를 기준으로 초기화
    for (let j = 0; j <= m; j++) d[0][j] = j;

    // 거리 행렬을 채우는 이중 루프
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1; // 문자가 같으면 비용은 0, 다르면 1
            d[i][j] = Math.min(
                d[i - 1][j] + 1,      // 삭제
                d[i][j - 1] + 1,      // 삽입
                d[i - 1][j - 1] + cost // 대체
            );
        }
    }

    return d[n][m]; // 최종 편집 거리 반환
}
// 한글 자모 분리 함수
function decomposeHangul(syllable: string) {
    const HANGUL_OFFSET = 0xAC00;
    const INITIAL_OFFSET = 0x1100;
    const MEDIAL_OFFSET = 0x1161;
    const FINAL_OFFSET = 0x11A7;

    const initialConsonants = [
        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    ];

    const medialVowels = [
        'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
    ];

    const finalConsonants = [
        '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    ];

    const code = syllable.charCodeAt(0) - HANGUL_OFFSET;
    const initialIndex = Math.floor(code / 588);
    const medialIndex = Math.floor((code % 588) / 28);
    const finalIndex = code % 28;

    return initialConsonants[initialIndex] + medialVowels[medialIndex] + finalConsonants[finalIndex];
}

function decompose(str: string) {
    return str.split('').map(char => {
        const isHangul = char.charCodeAt(0) >= 0xAC00 && char.charCodeAt(0) <= 0xD7A3;
        return isHangul ? decomposeHangul(char) : char;
    }).join('');
}

// 다음으로, compareTwoStrings 함수는 두 문자열 간의 유사도를 0에서 1 사이의 값으로 반환합니다.
// Levenshtein 거리를 기반으로 하여, 두 문자열의 길이에 따른 비율로 유사도를 계산합니다.
function compareTwoStrings(string1: any, string2: any) {
    const decomposedString1 = decompose(string1.toLowerCase());
    console.log(decomposedString1);
    const decomposedString2 = decompose(string2.toLowerCase());
    console.log(decomposedString2);
    const distance = levenshteinDistance(decomposedString1, decomposedString2);
    const maxLen = Math.max(decomposedString1.length, decomposedString2.length);
    return (maxLen - distance) / maxLen;
}


// ==============================================================================

// 문자열 유사도 라이브러리 대체 하드코딩

const menuOrderScenario = [
    { name: "아메리카노", variations: ["아메리카노", "아메리카노 주문", "아메리카노 주문할게요", "아메리카노 줘", "아메리카노 가져와"] },
    { name: "에스프레소", variations: ["에스프레소", "에스프레소 주문", "에스프레소 주문할게요", "에스프레소 줘", "에스프레소 가져와"] },
    { name: "에스프레소 쿠키라떼", variations: ["에스프레소 쿠키라떼", "에스프레소 쿠키라떼 주문", "에스프레소 쿠키라떼 주문할게요", "에스프레소 쿠키라떼 줘", "에스프레소 쿠키라떼 가져와"] },
    { name: "에스프레소 콘파냐", variations: ["에스프레소 콘파냐", "에스프레소 콘파냐 주문", "에스프레소 콘파냐 주문할게요", "에스프레소 콘파냐 줘", "에스프레소 콘파냐 가져와"] },
    { name: "클레식 민트 모카", variations: ["클레식 민트 모카", "클레식 민트 모카 주문", "클레식 민트 모카 주문할게요", "클레식 민트 모카 줘", "클레식 민트 모카 가져와"] },
    { name: "클레식 아포가토", variations: ["클레식 아포가토", "클레식 아포가토 주문", "클레식 아포가토 주문할게요", "클레식 아포가토 줘", "클레식 아포가토 가져와"] },
    { name: "카페라떼", variations: ["카페라떼", "카페라떼 주문", "카페라떼 주문할게요", "카페라떼 줘", "카페라떼 가져와"] },
    { name: "바닐라빈 라떼", variations: ["바닐라빈 라떼", "바닐라빈 라떼 주문", "바닐라빈 라떼 주문할게요", "바닐라빈 라떼 줘", "바닐라빈 라떼 가져와"] },
    { name: "카페모카", variations: ["카페모카", "카페모카 주문", "카페모카 주문할게요", "카페모카 줘", "카페모카 가져와"] },
    { name: "카페오레", variations: ["카페오레", "카페오레 주문", "카페오레 주문할게요", "카페오레 줘", "카페오레 가져와"] },
    { name: "카푸치노", variations: ["카푸치노", "카푸치노 주문", "카푸치노 주문할게요", "카푸치노 줘", "카푸치노 가져와"] },
    { name: "연유라떼", variations: ["연유라떼", "연유라떼 주문", "연유라떼 주문할게요", "연유라떼 줘", "연유라떼 주세요"] },





];

function orderMenuCheck(inputText: string) {
    let bestMatch = { name: "", similarity: 0 };

    for (const menu of menuOrderScenario) {
        for (const variation of menu.variations) {
            const similarity = compareTwoStrings(inputText, variation);
            if (similarity > bestMatch.similarity) {
                bestMatch = { name: menu.name, similarity };
            }
        }
    }

    if (bestMatch.similarity > 0.7) { // 유사도가 0.7 이상이면
        return `${bestMatch.name} 주문받았습니다.`;
    } else {
        return "죄송합니다. 주문을 이해하지 못했습니다.";
    }
}

console.log(orderMenuCheck("카페오 줘"));