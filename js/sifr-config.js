/**
*
* adds text to the fancy headings
*
* @param   string      the root location of playsega
*
**/
function addTextToHeadings(playsegaTop){
    var avenir = {
        src: playsegaTop + 'swf/avenir.swf'
    };

    var avenir2 = {
        src: playsegaTop + 'swf/avenir2.swf'
    };
    
    sIFR.activate(avenir); // From revision 209 and onwards
    sIFR.activate(avenir2); // From revision 209 and onwards

    sIFR.replace(avenir2, {
        selector: 'span.fancy'
        ,css: [
        '.sIFR-root { color: #ffffff; background-color: #ffd092; font-weight: bold; letter-spacing: 0.2; font-size: 13px}'
        ,'a { text-decoration: none }'
        ]
        , wmode: 'transparent'
        ,filters: {
            DropShadow: {
                distance: 1
                ,color: '#3974b7'
                ,angle: 270
                ,strength: 1
                ,blurX: 2
                ,blurY: 2
            }
        }
    });
    
    sIFR.replace(avenir, {
    	selector: 'span.fancy4'
    		,css: [
    		       '.sIFR-root { color: #555555; background-color: #FFFFFF; font-weight: bold; letter-spacing: 0.2; font-size: 12px}'
    		       ,'a { text-decoration: none }'
    		       ]
    		       , wmode: 'transparent'
    		    	   ,filters: false
    });

    sIFR.replace(avenir2, {
        selector: 'span.fancybutton'
        ,selectable: false
        ,css: [
        '.sIFR-root { color: #fffff; background-color: #ffd092; font-weight: bold; letter-spacing: 0.2; font-size: 13px; cursor: pointer}'
        ,'a { text-decoration: none }'
        ]
        , wmode: 'transparent'
        ,filters: {
            DropShadow: {
                distance: 1
                ,color: '#da790a'
                ,angle: 270
                ,strength: 1
                ,blurX: 2
                ,blurY: 2
            }
        }
    });

    sIFR.replace(avenir, {
        selector: 'span.fancylarge'
        ,css: [
        '.sIFR-root { color: #7B7A7A; background-color: transparent; font-size: 20px}'
        ,'.fancylargeOrange { color: #FB9A26 }'
        ]
        , wmode: 'transparent'
        ,filters: false
    });

    
    sIFR.replace(avenir, {
    	selector: 'span.fancylarger'
    		,css: [
    		       '.sIFR-root { color: #7B7A7A; background-color: transparent; font-size: 25px}'
    		       ,'.fancylargerOrange { color: #FB9A26 }'
    		       ]
    		       , wmode: 'transparent'
    		    	   ,filters: false
    });
    
    sIFR.replace(avenir2, {
        selector: 'span.fancyblue'
        ,css: [
        '.sIFR-root { color: #fffff; background-color: #ffd092; font-weight: bold; letter-spacing: 0.2; font-size: 13px}'
        ,'a { text-decoration: none }'
        ]
        , wmode: 'transparent'
        ,filters: {
            DropShadow: {
                distance: 1
                ,color: '#3974b7'
                ,angle: 270
                ,strength: 1
                ,blurX: 2
                ,blurY: 2
            }
        }
    });
/*
    sIFR.replace(avenir, {
        selector: 'div.fancy3'
        ,css: [
        '.sIFR-root { color: #4c4c4c; background-color: #ffd092; font-weight: bold; letter-spacing: -0.2; }'
        ,'a { text-decoration: none; }'
        ]
        , wmode: 'transparent'
        ,filters: {
            DropShadow: {
                distance: 1
                ,color: '#FFFFFF'
                ,strength: 1
                ,blurX: 1
                ,blurY: 1
            }
        }
    });*/
}