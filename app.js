// main logic to process then display JSON data
function processPlacesData(data) {
    allPlaces = data.map((item) => {
        const layerUpper = (item.layer || "").toUpperCase();
        const descUpper = (item.description || "").toUpperCase();

        // Determine Region from Layer Name (or Description)
        let region = "UNKNOWN";
        if (layerUpper.includes("ETOBICOKE") || descUpper.includes("ETOBICOKE")) {
            region = "ETOBICOKE";
        } else if (layerUpper.includes("SCARBOROUGH") || descUpper.includes("SCARBOROUGH")) {
            region = "SCARBOROUGH";
        } else if (layerUpper.includes("NORTH YORK") || descUpper.includes("NORTH YORK")) {
            region = "NORTH YORK";
        }

        // Determine if it's a Favourite (Checks boolean `fav` from JSON, with string fallbacks)
        const isFavourite =
            item.fav === true ||
            layerUpper.includes("FAV") ||
            descUpper.includes("FAV") ||
            layerUpper.includes("KEVIN") ||
            descUpper.includes("KEVIN");

        return {
            title: item.name || "Unnamed Location",
            note: item.description || "",
            url: item.google_maps_url || "",
            region: region,
            isFavourite: isFavourite,
        };
    });

    // Shuffle list
    for (let i = allPlaces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = allPlaces[i];
        allPlaces[i] = allPlaces[j];
        allPlaces[j] = temp;
    }

    // render global list, initially with ALL filter
    renderList("ALL");
}