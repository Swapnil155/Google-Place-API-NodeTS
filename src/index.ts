import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = 3000;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY; // Replace with your Google API Key

interface PlaceSuggestion {
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    exactMatch: 'city' | 'state' | 'country' | null;
}
// Define the endpoint to fetch a place by text query
app.get('/find-place', async (req: Request, res: Response) => {
    try {
        // Extract query from request parameters (default to a specific value if not provided)
        const query: string = req.query.query as string || 'Museum of Contemporary Art Australia';

        // Step 1: Find the Place ID using the Find Place API
        const findPlaceResponse = await axios.get(
            'https://maps.googleapis.com/maps/api/place/findplacefromtext/json',
            {
                params: {
                    key: GOOGLE_MAPS_API_KEY,
                    input: query,
                    inputtype: 'textquery',
                    fields: 'place_id',
                },
            }
        );

        if (
            findPlaceResponse.data.status !== 'OK' ||
            !findPlaceResponse.data.candidates ||
            findPlaceResponse.data.candidates.length === 0
        ) {
            res.status(404).json({ error: 'Place not found' });
            return;
        }

        const placeId = findPlaceResponse.data.candidates[0].place_id;

        // Step 2: Fetch complete details using the Place Details API
        const placeDetailsResponse = await axios.get(
            'https://maps.googleapis.com/maps/api/place/details/json',
            {
                params: {
                    key: GOOGLE_MAPS_API_KEY,
                    place_id: placeId,
                    fields: [
                        'name',
                        'formatted_address',
                        'geometry',
                        'address_components',
                        // 'international_phone_number',
                        // 'opening_hours',
                        // 'website',
                        // 'reviews',
                        // 'types',
                    ].join(','),
                },
            }
        );

        if (placeDetailsResponse.data.status !== 'OK') {
            res.status(500).json({ error: 'Failed to fetch place details' });
            return;
        }

        // Respond with complete place details
        res.json(placeDetailsResponse.data);
    } catch (error) {
        // Handle errors gracefully
        console.error('Error fetching place information:', error);
        res.status(500).json({ error: 'Failed to fetch place information' });
    }
});


app.get('/autocomplete', async (req: Request, res: Response) => {
    try {
        // Extract and validate the input query parameter
        const input: string = req.query.input as string;
        if (!input || input.trim() === '') {
            res.status(400).json({ error: 'Input parameter is required' });
            return;
        }

        // Step 1: Call Google Places Autocomplete API
        const googleResponse = await axios.get(
            'https://maps.googleapis.com/maps/api/place/autocomplete/json',
            {
                params: {
                    key: GOOGLE_MAPS_API_KEY,
                    input,
                    types: 'geocode',
                    language: 'en',
                },
            }
        );

        // Step 2: Check Google API response status
        if (googleResponse.data.status !== 'OK') {
            res.status(500).json({
                error: 'Failed to fetch autocomplete suggestions',
                details: googleResponse.data,
            });
            return;
        }

        // Step 3: Transform Google API predictions
        const predictions = googleResponse.data.predictions.map((prediction: any) =>
            prediction.terms.map((term: { value: string }) => term.value)
        );

        const placeSuggestions: PlaceSuggestion[] = predictions.map((terms: string[]) => {
            return {
                name: terms[0],
                city: terms.slice(-3)[0] || '',
                state: terms.slice(-2)[0] || '',
                country: terms.slice(-1)[0] || '',
                address: terms.slice(1).join(', '),
                exactMatch: null, // Initial value
            };
        });

        // Step 4: Filter and Sort Results
        const inputLower = input.toLowerCase();

        const filteredResults = placeSuggestions
            .filter((place) => {
                // Include entries that match partially in city, state, or country
                return (
                    place.city.toLowerCase().includes(inputLower) ||
                    place.state.toLowerCase().includes(inputLower) ||
                    place.country.toLowerCase().includes(inputLower)
                );
            })
            .map((place) => {
                // Assign exactMatch flag for sorting
                if (place.country.toLowerCase() === inputLower) {
                    place.exactMatch = 'country';
                } else if (place.state.toLowerCase() === inputLower) {
                    place.exactMatch = 'state';
                } else if (place.city.toLowerCase() === inputLower) {
                    place.exactMatch = 'city';
                }
                return place;
            })
            .sort((a, b) => {
                // Prioritize exact matches over partial matches
                const priorityOrder = { city: 3, state: 2, country: 1, null: 0 };
                return priorityOrder[b.exactMatch || 'null'] - priorityOrder[a.exactMatch || 'null'];
            });

        // Step 5: Remove Duplicates (Optional)
        const uniqueResults: PlaceSuggestion[] = [];
        const seen = new Set<string>();
        for (const place of filteredResults) {
            const key = `${place.name}|${place.address}`;
            if (!seen.has(key)) {
                uniqueResults.push(place);
                seen.add(key);
            }
        }

        // Respond with filtered and sorted autocomplete results
        res.json(uniqueResults);
    } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to fetch complete place details
app.get('/place-details', async (req: Request, res: Response) => {
    try {
        // Extract query from request parameters (default to a specific value if not provided)
        const query: string = req.query.query as string || 'Museum of Contemporary Art Australia';

        // Step 1: Find the Place ID using the Find Place API
        const findPlaceResponse = await axios.get(
            'https://maps.googleapis.com/maps/api/place/findplacefromtext/json',
            {
                params: {
                    key: GOOGLE_MAPS_API_KEY,
                    input: query,
                    inputtype: 'textquery',
                    fields: 'place_id',
                },
            }
        );

        if (
            findPlaceResponse.data.status !== 'OK' ||
            !findPlaceResponse.data.candidates ||
            findPlaceResponse.data.candidates.length === 0
        ) {
            res.status(404).json({ error: 'Place not found' })
            return;
        }

        const placeId = findPlaceResponse.data.candidates[0].place_id;

        // Step 2: Fetch complete details using the Place Details API
        const placeDetailsResponse = await axios.get(
            'https://maps.googleapis.com/maps/api/place/details/json',
            {
                params: {
                    key: GOOGLE_MAPS_API_KEY,
                    place_id: placeId,
                    fields: [
                        'name',
                        'formatted_address',
                        'geometry',
                        'address_components',
                        'international_phone_number',
                        'opening_hours',
                        'website',
                        'reviews',
                        'types',
                    ].join(','),
                },
            }
        );

        if (placeDetailsResponse.data.status !== 'OK') {
            res.status(500).json({ error: 'Failed to fetch place details' })
            return;
        }

        // Respond with complete place details
        res.json(placeDetailsResponse.data.result);
    } catch (error) {
        // Handle errors gracefully
        console.error('Error fetching place details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
