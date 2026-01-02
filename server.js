const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🕵️ GLOBAL LOGGER ---
app.use((req, res, next) => {
    console.log(`📡 [LOG]: ${req.method} request to: ${req.url}`);
    next();
});

// --- 1. ROOT HANDLER ---
// Prevents the blue circle if Monday pings the Base URL directly
app.all('/', (req, res) => {
    return res.status(200).json({
        type: "status-column-value",
        outboundType: "status-column-value",
        contextualParameters: { columnId: "columnId" }
    });
});

// --- 2. FIELD DEFINITION (Handshake) ---
// Links the 'status_value' field to your 'columnId' selection
app.all('/get-status-field-defs', (req, res) => {
    console.log("🟦 [HANDSHAKE]: Sending metadata for columnId");
    return res.status(200).json({
        type: "status-column-value",
        outboundType: "status-column-value",
        contextualParameters: {
            columnId: "columnId" // Matches your dependency key exactly
        }
    });
});

// --- 3. REMOTE OPTIONS (The Label Fetcher) ---
// This turns the "Search" box into a list of your actual Status labels
app.post('/get-status-labels', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const { boardId, columnId } = payload.inputFields;

        console.log(`🔍 [FETCHING]: Getting labels for Board: ${boardId}, Column: ${columnId}`);

        const query = `query {
            boards (ids: ${boardId}) {
                columns (ids: "${columnId}") {
                    settings_str
                }
            }
        }`;

        const response = await axios.post('https://api.monday.com/v2', { query }, {
            headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'API-Version': '2024-01' 
            }
        });

        const columnData = response.data.data.boards[0].columns[0];
        const settings = JSON.parse(columnData.settings_str);
        
        // Maps the column labels (e.g., "Done", "Stuck") to the dropdown
        const options = Object.entries(settings.labels).map(([id, label]) => ({
            title: label,
            value: id
        }));

        console.log(`✅ [SUCCESS]: Found ${options.length} labels.`);
        return res.status(200).json(options);

    } catch (err) {
        console.error("❌ [LABEL ERROR]:", err.message);
        return res.status(200).json([]); 
    }
});

// --- 4. STATIC DROPDOWN OPTIONS ---
