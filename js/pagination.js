/**
 * NOTE FROM MARK ON 30/06/09 - NOT SURE WHAT THIS FIRST FUNCTION IS, BUT I'M HIJACKING THIS FILE! :)
 */
function checkPageReq (pageReq, maxPage) {
    pageReq = parseInt (pageReq);
    maxPage = parseInt (maxPage);

    if (pageReq <= maxPage && pageReq > 0) {
        return true;
    } else {
        return false;
    }
}

function setStart (whichWay, levels_per_page, totalpages) {
	var start, nextPage;

    if (whichWay == 'prev') {
        start = (document.getElementById('start').value * 1) - levels_per_page;
        nextPage = (document.getElementById('curPage').value * 1) - 1;
        if (nextPage >= 1) {
            document.getElementById('start').value = start;
            document.getElementById('curPage').value = nextPage;
            return true;
        } else {
            return false;
        }
    } else {
        start = (document.getElementById('start').value * 1) + levels_per_page;
        nextPage = (document.getElementById('curPage').value * 1) + 1;
        if (nextPage <= totalpages) {
            document.getElementById('start').value = start;
            document.getElementById('curPage').value = nextPage;
            return true;
        } else {
            return false;
        }
    }
}

function getStart () {
    return document.getElementById('start').value * 1;
}
