function show(enabled, useSettingsInsteadOfPreferences) {
    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('state-on')[0].innerText = "UserScript Manager Safari 扩展当前已启用。可以在 Safari 设置的扩展部分关闭。";
        document.getElementsByClassName('state-off')[0].innerText = "UserScript Manager Safari 扩展当前未启用。可以在 Safari 设置的扩展部分启用。";
        document.getElementsByClassName('state-unknown')[0].innerText = "可以在 Safari 设置的扩展部分启用 UserScript Manager Safari。";
        document.getElementsByClassName('open-preferences')[0].innerText = "退出并打开 Safari 设置…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
