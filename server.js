const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🕵️ DEBUG LOGGING ---
app.use((req, res, next) => {
    console.log(`📡 [${req.method}] ${req.path}`);
    if (Object.keys(req.body).length) console.log("📦 Body:", JSON.stringify(req.body));
    next();
});

// --- 🛠️ THE DYNAMIC MAPPING HANDLER ---
// URL: https://YOUR-URL.onrender.com/status-logic
app.all('/status-logic', async (req, res) => {
    // 1. Handle GET (Verify/Handshake) to clear the blue circle
    if (req.method === 'GET') {
        console.log("🟦 Received GET - Sending Initial Handshake");
        return res.status(200).send([{ 
            id: "status_value", 
            title: "Status Column Value", 
            outboundType: "text", 
            inboundTypes: ["text"] 
        }]);
    }

    const payload = req.body.payload || req.body;
    const boardId = payload.boardId || payload.inputFields?.boardId;
    const columnId = payload.columnId || payload.inputFields?.columnId;

    // 2. Handle POST with Data (Fetch live labels from the board)
    if (boardId && columnId) {
        try {
            console.log(`🔍 Fetching live labels for Board ${boardId}, Column ${columnId}`);
            const query = `query { boards (ids: ${boardId}) { columns (ids: "${columnId}") { settings_str } } }`;
            const response = await axios.post('https://api.monday.com/v2', { query }, {
                headers: { 
                    'Authorization': process.env.MONDAY_API_TOKEN, 
                    'API-Version': '2024-01' 
                }
            });

            const settings = JSON.parse(response.data.data.boards[0].columns[0].settings_str);
            
            // Map labels into the Dynamic Mapping array format
            const fields = Object.entries(settings.labels).map(([id, label]) => ({ 
                id: id,            // The Index (e.g., "1")
                title: label,       // The Label (e.g., "Done")
                outboundType: "text",
                inboundTypes: ["text"]
            }));

            console.log(`✅ Success: Sent ${fields.length} labels back to Monday.`);
            return res.status(200).send(fields);
        } catch (e) { 
            console.error("❌ API Fetch Error:", e.message);
            return res.status(200).send([]); 
        }
    }

    // 3. Fallback Handshake for POST requests with no data yet
    return res.status(200).send([{ 
        id: "status_value", 
        title: "Status Column Value", 
        outboundType: "text", 
        inboundTypes: ["text"] 
    }]);
});

// --- 🚀 THE RECURRING TASK ACTION ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        
        const { boardId, columnId, status_value, task_name, assignee_id } = inputFields;
        
        // Extract the Index ID from the dynamic field
        const statusIndex = status_value?.id || status_value;

        // Date Calculation Logic
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
        const dateString = d.toISOString().split('T')[0];

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": dateString },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [columnId]: { "index": parseInt(statusIndex) } // Setting status via Index
        };

        const query = `mutation { 
            create_item (
                board_id: ${parseInt(boardId)}, 
                item_name: "${task_name}", 
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'Content-Type': 'application/json', 
                'API-Version': '2024-01' 
            } 
        });

        console.log("🚀 Created recurring task successfully.");
        res.status(200).send({});
    } catch (err) {
        console.error("❌ Action failed:", err.message);
        res.status(200).send({});
    }
});

// --- 📅 STATIC DROPDOWNS ---
app.all('/get-nth-options', (req, res) => res.json([
    {title:"1st",value:"1"}, {title:"2nd",value:"2"}, {title:"3rd",value:"3"}, {title:"4th",value:"4"}
]));
app.all('/get-day-options', (req, res) => res.json([
    {title:"Monday",value:"1"}, {title:"Tuesday",value:"2"}, {title:"Wednesday",value:"3"}, 
    {title:"Thursday",value:"4"}, {title:"Friday",value:"5"}, {title:"Saturday",value:"6"}, {title:"Sunday",value:"0"}
]));

// --- 🏁 START SERVER ---
const PORT = 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
