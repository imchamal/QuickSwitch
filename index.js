import { animation_duration, eventSource, event_types, getThumbnailUrl, characters, this_chid, selectCharacterById } from '../../../../script.js';
import { power_user } from '../../../power-user.js';
import { getUserAvatar, getUserAvatars, setUserAvatar, user_avatar } from '../../../personas.js';
import { Popper } from '../../../../lib.js';

/** @type {Popper.Instance} */
let popper = null;

// 팝업 열림 여부
let isOpen = false;

// 마지막으로 열었던 탭을 기억 (재오픈 시 유지)
// 캐릭터 탭이 기본값
let activeTab = 'character';

// SillyTavern 버전이 페르소나 썸네일 API를 지원하는지 확인
const supportsPersonaThumbnails = getThumbnailUrl('persona', 'test.png', true).includes('&t=');

// ─── 이미지 URL 헬퍼 ─────────────────────────────────────────────

/**
 * 페르소나 이미지 URL 반환
 * @param {string} avatar  페르소나 파일명
 */
function getPersonaImageUrl(avatar) {
    if (supportsPersonaThumbnails) {
        return getThumbnailUrl('persona', avatar, true);
    }
    // 구버전 SillyTavern 호환: 캐시 버스팅 쿼리 추가
    return `${getUserAvatar(avatar)}?t=${Date.now()}`;
}

/**
 * 캐릭터 아바타 썸네일 URL 반환
 * @param {string} avatar  캐릭터 파일명 (예: "Astra.png")
 */
function getCharacterImageUrl(avatar) {
    return getThumbnailUrl('avatar', avatar);
}

// ─── 버튼 삽입 ───────────────────────────────────────────────────

/**
 * 채팅 입력창 왼쪽에 Quick Switch 버튼을 추가한다.
 * Quick Persona와 동일한 위치·구조를 사용한다.
 */
function addQuickSwitchButton() {
    const html = `
    <div id="quickSwitch" class="interactable" tabindex="0">
        <img id="quickSwitchImg" src="/img/ai4.png" />
    </div>`;

    $('#leftSendForm').append(html);
    $('#quickSwitch').on('click', () => toggleMenu());
}

// ─── 팝업 열기 / 닫기 ────────────────────────────────────────────

async function toggleMenu() {
    if (isOpen) {
        closeMenu();
    } else {
        await openMenu();
    }
}

async function openMenu() {
    isOpen = true;

    // 메뉴 골격 생성 (탭 헤더 + 목록 영역)
    const menu = $(`
        <div id="quickSwitchMenu">
            <div id="quickSwitchTabs">
                <button class="quickSwitchTab ${activeTab === 'character' ? 'active' : ''}" data-tab="character">캐릭터</button>
                <button class="quickSwitchTab ${activeTab === 'persona'   ? 'active' : ''}" data-tab="persona">페르소나</button>
            </div>
            <ul class="list-group"></ul>
        </div>
    `);

    menu.hide();
    $(document.body).append(menu);

    // 탭 버튼 클릭 → 목록 전환
    menu.find('.quickSwitchTab').on('click', async function () {
        activeTab = $(this).data('tab');
        menu.find('.quickSwitchTab').removeClass('active');
        $(this).addClass('active');
        await renderList(menu.find('ul'), activeTab);
    });

    // 기본 탭 내용 렌더링
    await renderList(menu.find('ul'), activeTab);

    
    menu.fadeIn(animation_duration);

    // Popper로 버튼 위쪽에 팝업 위치 고정
    popper = Popper.createPopper(
        document.getElementById('quickSwitch'),
        document.getElementById('quickSwitchMenu'),
        { placement: 'top-start' },
    );
    popper.update();
}

function closeMenu() {
    isOpen = false;
    $('#quickSwitchMenu').fadeOut(animation_duration, () => {
        $('#quickSwitchMenu').remove();
    });
    popper?.destroy();
    popper = null;
}

// ─── 목록 렌더링 ─────────────────────────────────────────────────

/**
 * 탭에 맞는 목록을 ul 안에 렌더링한다.
 * @param {JQuery} ul
 * @param {'character'|'persona'} tab
 */
async function renderList(ul, tab) {
    ul.empty();
    if (tab === 'character') {
        renderCharacters(ul);
    } else {
        await renderPersonas(ul);
    }
}

/**
 * 캐릭터 목록 렌더링
 * characters 배열을 순회하며 아바타 이미지 버튼을 생성한다.
 */
function renderCharacters(ul) {
    if (!characters || characters.length === 0) {
        ul.append('<li class="list-group-item quickSwitchEmpty">캐릭터가 없습니다</li>');
        return;
    }

    for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        const imgUrl = getCharacterImageUrl(char.avatar);

        // 현재 선택된 캐릭터 강조 표시
        // this_chid는 script.js에서 export된 live binding
        const isSelected = i === Number(this_chid);

        const item = $('<li tabindex="0" class="list-group-item interactable"><img class="quickSwitchMenuImg"/></li>');
        item.find('img')
            .attr('src', imgUrl)
            .attr('title', char.name)
            .toggleClass('selected', isSelected);

        item.on('click', () => {
            closeMenu();
            selectCharacter(i);
        });

        ul.append(item);
    }
}

/**
 * 페르소나 목록 렌더링
 * Quick Persona의 로직과 동일하다.
 */
async function renderPersonas(ul) {
    const userAvatars = await getUserAvatars(false);

    if (!userAvatars || userAvatars.length === 0) {
        ul.append('<li class="list-group-item quickSwitchEmpty">페르소나가 없습니다</li>');
        return;
    }

    for (const avatar of userAvatars) {
        const name = power_user.personas[avatar] || avatar;
        const title = power_user.persona_descriptions[avatar]?.title || '';
        const imgUrl = getPersonaImageUrl(avatar);
        const imgTitle = title ? `${name} — ${title}` : name;
        const isSelected = avatar === user_avatar;
        const isDefault = avatar === power_user.default_persona;

        const item = $('<li tabindex="0" class="list-group-item interactable"><img class="quickSwitchMenuImg"/></li>');
        item.find('img')
            .attr('src', imgUrl)
            .attr('title', imgTitle)
            .toggleClass('selected', isSelected)
            .toggleClass('default', isDefault);

        item.on('click', async () => {
            closeMenu();
            await setUserAvatar(avatar);
            updateButtonImage();
        });

        ul.append(item);
    }
}

// ─── 캐릭터 전환 ─────────────────────────────────────────────────

/**
 * SillyTavern 내부의 캐릭터 선택 UI 요소를 트리거한다.
 *
 * SillyTavern은 캐릭터 목록을 #rm_print_characters_block 안에 렌더링하고,
 * 각 항목에 chid 속성(characters 배열의 인덱스)을 부여한다.
 * 해당 요소를 클릭하면 SillyTavern의 기본 캐릭터 로딩 로직이 실행된다.
 *
 * ⚠️ SillyTavern 버전에 따라 DOM 구조가 다를 수 있다.
 *    선택이 안 될 경우 아래 fallback 주석을 참고하라.
 *
 * @param {number} charId  characters 배열의 인덱스
 */
/**
 * SillyTavern의 selectCharacterById를 직접 호출해 캐릭터를 전환한다.
 * DOM 클릭 시뮬레이션 없이 동작하므로 캐릭터 목록 패널이
 * 렌더링되어 있지 않아도 안전하게 작동한다.
 * @param {number} charId  characters 배열의 인덱스
 */
async function selectCharacter(charId) {
    await selectCharacterById(charId);
}

// ─── 버튼 이미지 갱신 ────────────────────────────────────────────

/**
 * 현재 페르소나의 이미지와 이름으로 버튼을 업데이트한다.
 * 채팅방·설정이 바뀔 때 자동 호출된다.
 */
function updateButtonImage() {
    // setUserAvatar 등이 완료된 뒤 DOM을 읽어야 하므로 약간 지연
    setTimeout(() => {
        const imgUrl = getPersonaImageUrl(user_avatar);
        const name = power_user.personas[user_avatar] || user_avatar;
        $('#quickSwitchImg').attr('src', imgUrl).attr('title', name);
    }, 100);
}

// ─── 초기화 ──────────────────────────────────────────────────────

jQuery(() => {
    // 채팅 입력창에 버튼 삽입
    addQuickSwitchButton();

    // 채팅방·설정 변경 시 버튼 이미지 동기화
    eventSource.on(event_types.CHAT_CHANGED, updateButtonImage);
    eventSource.on(event_types.SETTINGS_UPDATED, updateButtonImage);

    // 메뉴 외부 클릭 시 닫기
    $(document.body).on('click', (e) => {
        if (
            isOpen &&
            !e.target.closest('#quickSwitchMenu') &&
            !e.target.closest('#quickSwitch')
        ) {
            closeMenu();
        }
    });

    // 초기 버튼 이미지 설정
    updateButtonImage();
});
