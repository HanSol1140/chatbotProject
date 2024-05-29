프로젝트 : 커피숍 챗봇

설명 : 
커피숍에서 손님의 주문에 따라 정해진 응답을 출력하고, 옵션코드를 생성하는 nodejs챗봇 프로그램을 제작

STT된 손님의 음성 텍스트에서 우리 메뉴와 옵션에 해당하는 키워드를 인식하여 해당 옵션이 주문되었음을 인지하고
그에 맞는 응답과 옵션코드를 생성하는 챗봇
* 손님들의 언어는 한국어를 사용함

설명을 위한 예시
메뉴명 : 아메리카노(101), 카페라떼 (102)
온도 : 사용안함(0), 핫(1), 아이스(2)
사이즈 : 사용안함(0), Tall(1), Grande(2), Venti(3)
원두 종류(기본 마일드로스트) : 사용안함(0), 마일드로스트(1), 다크로스트(2)
카페인 농도(015(기본15%)) : 0~45%에서 5%단위로 설정
디카페인 농도(000(기본0%)) : 0~45%에서 5%단위로 설정 => 메뉴에 따라(디카페인커피) 디카페인 농도가 15%가 기본이고 카페인농도가 0%인 경우도 있음
시럽 : 사용안함(0), 바닐라시럽(1), 카라멜시럽(2), 메이플시럽(3)...그외 기타 옵션들 + 적게/보통/많이(기본보통)(1,2,3)
파우더 : 사용안함(0), 바닐라파우더(1), 카라멜파우더(2), 메이플파우더(3)... + 적게/보통/많이(기본보통)(1,2,3)
드리즐 : 사용안함(0), 바닐라드리즐(1), 카라멜드리즐(2), 메이플드리즐(3)... + 적게/보통/많이(기본보통)(1,2,3) 
휘핑크림 : 사용안함(0), 적게(1), 보통(2), 많이(3)
우유추가 : 사용안함(0), 일반우유(1), 저지방(2), 오트(3), 귀리(4), 토피넛(5) + 적게/보통/많이(기본보통)(1,2,3)
우유변경 : 사용안함(0) 일반우유(1), 저지방(2), 오트(3), 귀리(4), 토피넛(5) + 적게/보통/많이(기본보통)(1,2,3)
토핑 : 사용안함(0), 쿠키(1), 오레오(2), 카라멜큐브 (3)... 기타등등
수량 : 갯수만큼 값 입력(최소1)


여기에서
메뉴명, 온도, 사이즈는 반드시 입력받아야하는 필수옵션이다. (케이크와 종류라면 해당 옵션들을 전부 입력받지 않음(수량만 존재)), 메뉴마다 보유옵션에서 필수옵션 테이블과 선택옵션 테이블이 존재함
아메리카노의 경우 주문에 온도/사이즈/원두/카페인농도, 디카페인농도가 필수옵션이지만
원두와 카페인농도, 디카페인 농도는 default값이 존재함으로써 필수가 아닌것처럼 취급됨

예시 1.
주문 => "아이스 아메리카노 벤티사이즈 바닐라시럽 추가해줘"
옵션코드 => 101-2-3-1-015-000-12-0-0-0-0-0-0-1가 생성
응답 => "{온도} {메뉴명} {사이즈}사이즈 {추가한 시럽 + 시럽의 양} {추가한 파우더 + 양(사용안함(0)시 ""처리)} {추가한 드리즐 + 양(사용안함(0)시 ""처리)}..... 을 추가하셨습니다. 주문이 완료되셨다면 '주문완료'를 말씀해주세요."

예시 2.
주문 => "아메리카노 바닐라시럽 추가해줘"
*   여기서 아메리카노에 온도와 사이즈는 '반드시' 필요함
    따라서 101-0-0-1-015-000-12-0-0-0-0-0-0-1가 생성이되지만
    다음 응답은 "온도와 사이즈를 선택해주세요"가 될것이고
    온도와 사이즈를 말한다면 (필수 옵션리스트가 충분히 채워졋으므로) 바로 
    응답 => "{온도} {메뉴명} {사이즈}사이즈 {추가한 시럽 + 시럽의 양} {추가한 파우더 + 양(사용안함(0)시 ""처리)} {추가한 드리즐 + 양(사용안함(0)시 ""처리)}..... 을 추가하셨습니다. 주문이 완료되셨다면 '주문완료'를 말씀해주세요."
    을 응답하고 그에맞는 옵션코드를 재생성함


중요한것은

메뉴명, 온도,사이즈, 원두, 카페인농도, 디카페인농도, 시럽, 파우더, 드리즐, 휘핑크림, 우유추가, 우유변경, 토핑, 수량등 해당 언어에맞는 키워드를 인식하고
사람의 말에서 해당 키워드들을 인식할때마다 옵션을 입력받고, 충분히 채워졋을경우 주문완료여부를 묻는것


엄청 단순하지만 사용한 알고리즘(다른 알고리즘을 사용하거나 수정시켜서 좀 더 발전시켜도됨)을 보여주기위한 예시코드
```
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
function levenshteinDistance(s:any, t:any) {
    const n:number = s.length; // 첫 번째 문자열의 길이
    const m:number = t.length; // 두 번째 문자열의 길이
    const d:any = []; // 거리 행렬

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
function decomposeHangul(syllable:string) {
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

function decompose(str:string) {
    return str.split('').map(char => {
        const isHangul = char.charCodeAt(0) >= 0xAC00 && char.charCodeAt(0) <= 0xD7A3;
        return isHangul ? decomposeHangul(char) : char;
    }).join('');
}

// 다음으로, compareTwoStrings 함수는 두 문자열 간의 유사도를 0에서 1 사이의 값으로 반환합니다.
// Levenshtein 거리를 기반으로 하여, 두 문자열의 길이에 따른 비율로 유사도를 계산합니다.
function compareTwoStrings(string1:any, string2:any) {
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
    { name: "아메리카노", variations: ["아메리카노", "아메리카노 주문", "아메리카노 주문할게요" , "아메리카노 줘", "아메리카노 가져와"]},
    { name: "카페라떼", variations: ["카페라떼", "카페라떼 주문", "카페라떼 주문할게요", "카페라떼 줘", "카페라떼 가져와"]},
    { name: "연유라떼", variations: ["연유라떼", "연유라떼 주문", "연유라떼 주문할게요", "연유라떼 줘", "연유라떼 주세요"]}
];

function orderMenuCheck(inputText:string) {
    let bestMatch = { name: "", similarity: 0 };

    for (const menu of menuOrderScenario) {
        for (const variation of menu.variations) {
            const similarity = compareTwoStrings(inputText, variation);
            if (similarity > bestMatch.similarity) {
                bestMatch = { name: menu.name, similarity };
            }
        }
    }

    if (bestMatch.similarity > 0.8) { // 유사도가 0.7 이상이면
        return `${bestMatch.name} 주문받았습니다.`;
    } else {
        return "죄송합니다. 주문을 이해하지 못했습니다.";
    }
}

console.log(orderMenuCheck("여누라떼"));
```

지금 설명한 요구사항에 따르기엔 많이 부족하지만, 내가사용한 알고리즘을 보여주기위한 코드임(참고만 하면된다는말)

자, 그럼 이제 내 요구사항을 충족시키기위한 코드를 만드는 방법을 가이드해줄래?