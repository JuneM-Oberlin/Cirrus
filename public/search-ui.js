const CirrusSearchUI = (function () {
    let searchButton = null;
    let prefersReducedMotion = () => false;

    function init({ prefersReducedMotionFn }) {
        prefersReducedMotion = prefersReducedMotionFn;
        searchButton = document.querySelector(".search-row button");
        if (!searchButton) {
            return;
        }
        searchButton.addEventListener("animationend", (event) => {
            if (event.target !== searchButton || event.animationName !== "searchPressGlow") {
                return;
            }
            searchButton.classList.remove("search-press-feedback");
        });
    }

    function setSearching(isSearching) {
        if (!searchButton) {
            return;
        }
        searchButton.classList.toggle("is-searching", isSearching);
    }

    function playPressGlow() {
        if (!searchButton || prefersReducedMotion()) {
            return;
        }
        searchButton.classList.remove("search-press-feedback");
        void searchButton.offsetWidth;
        searchButton.classList.add("search-press-feedback");
    }

    return { init, setSearching, playPressGlow };
})();
