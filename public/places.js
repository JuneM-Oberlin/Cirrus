/* Place names for search: tidying what you type, describing the matches
   the server finds, and the "query" strings the rest of the app passes
   around.

   A query is either a plain search ("Denver", "Canton,OH,US") or a picked
   place, written "Canton, Ohio@40.7990,-81.3784": the label to show, then
   the exact position to load, so a town is never mixed up with another
   one of the same name. */

const CirrusPlaces = (function () {
    const US_STATES = {
        AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
        CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
        FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
        IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
        ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
        MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
        NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
        NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
        PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
        TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
        WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
        PR: "Puerto Rico",
    };
    const NAME_STARTS = ["port", "fort", "lake", "mount", "west", "east", "north", "south", "new", "upper", "lower"];
    const PICKED = /^(.+)@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;
    const TYPED_US = /^(.+?),([A-Z]{2}),US$/;

    // "OH", "oh", "Ohio", or "D.C." -> the two-letter code; anything else -> null.
    function stateCode(text) {
        const cleaned = text.replace(/\./g, "").trim();
        const upper = cleaned.toUpperCase();
        if (US_STATES[upper]) {
            return upper;
        }
        const lower = cleaned.toLowerCase();
        const code = Object.keys(US_STATES).find((key) => US_STATES[key].toLowerCase() === lower);
        if (code) {
            return code;
        }
        return null;
    }

    // Typing a US state finds the right town: "Canton OH", "Canton, Ohio",
    // and "augusta ga" all become "Canton,OH,US"-style searches, which the
    // weather service understands. Anything else comes back as typed.
    function tidy(text) {
        const typed = text.trim().replace(/\s+/g, " ");
        // a state on its own ("Georgia", "West Virginia") stays a plain search
        if (stateCode(typed)) {
            return typed;
        }
        const withComma = /^(.+?)\s*,\s*([^,]+?)(?:\s*,\s*(?:US|USA|United States))?$/i.exec(typed);
        if (withComma && stateCode(withComma[2])) {
            return withComma[1] + "," + stateCode(withComma[2]) + ",US";
        }
        // No comma: the last one or two words may be the state. A lone word
        // like "Port" or "Fort" before it means the state name is part of
        // the town's name instead ("Port Washington", "West New York").
        const words = typed.split(" ");
        for (const count of [2, 1]) {
            if (words.length > count) {
                const code = stateCode(words.slice(-count).join(" "));
                const town = words.slice(0, -count).join(" ");
                if (code && !NAME_STARTS.includes(town.toLowerCase())) {
                    return town + "," + code + ",US";
                }
            }
        }
        return typed;
    }

    function isPicked(query) {
        return PICKED.test(query);
    }

    // { label, lat, lon } for a picked place; { label } for a plain search.
    function parse(query) {
        const picked = PICKED.exec(query);
        if (picked) {
            return { label: picked[1], lat: Number(picked[2]), lon: Number(picked[3]) };
        }
        const typedUs = TYPED_US.exec(query);
        if (typedUs) {
            return { label: typedUs[1] + ", " + typedUs[2] };
        }
        return { label: query };
    }

    function labelOf(query) {
        return parse(query).label;
    }

    // The town alone, for the location pill: "Canton, Ohio" -> "Canton".
    function shortName(query) {
        return labelOf(query).split(",")[0].trim();
    }

    // The part of a /weather, /forecast, or /sixhour address after the "?".
    function requestParams(query) {
        const place = parse(query);
        if (place.lat !== undefined) {
            return "lat=" + encodeURIComponent(place.lat) + "&lon=" + encodeURIComponent(place.lon);
        }
        return "city=" + encodeURIComponent(query);
    }

    function countryName(code) {
        try {
            return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
        } catch (err) {
            return code;
        }
    }

    // How a match reads in the list: "Canton, Ohio" for US towns,
    // "Augsburg, Germany" elsewhere. When two matches share a name and
    // country, the state or province is added to tell them apart.
    function describe(place, allMatches = []) {
        if (place.country === "US" && place.state) {
            return place.name + ", " + place.state;
        }
        const twins = allMatches.filter((other) => other.name === place.name && other.country === place.country);
        if (twins.length > 1 && place.state) {
            return place.name + ", " + place.state + ", " + countryName(place.country);
        }
        return place.name + ", " + countryName(place.country);
    }

    function fromPlace(place, allMatches = []) {
        return describe(place, allMatches) + "@" + place.lat.toFixed(4) + "," + place.lon.toFixed(4);
    }

    return {
        tidy,
        isPicked,
        parse,
        labelOf,
        shortName,
        requestParams,
        describe,
        fromPlace,
    };
})();
