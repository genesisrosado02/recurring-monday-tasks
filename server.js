const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🛠️ THE UNIVERSAL STATUS HANDLER ---
// Use this for BOTH "Field Definitions" and "Remote Options"
app.all('/status-logic', async (req, res) => {
    const payload = req.body.payload || req.body;
    
    // Check for incoming board/column data from the recipe
    const { boardId, columnId } = payload.inputFields || payload;

    if (boardId && columnId) {
        try {
            console.log(`📡 Fetching labels for Board: ${boardId}, Column: ${columnId}`);
            
            // Querying the board to get the specific column settings
            const query = `query { boards (ids: ${boardId}) { columns (ids: "${columnId}") { settings_str } } }`;
            const response = await axios.post('https://api.monday.com/v2', { query }, {
                headers: { 
                    'Authorization': process.env.MONDAY_API_TOKEN, 
                    'API-Version': '2024-01' 
                }
            });

            // Parsing labels directly from the column settings
            const settings = JSON.parse(response.data.data.boards[0].columns[0].settings_str);
            const options = Object.entries(settings.labels).map(([id, label]) => ({ 
                title: label, 
                value: id 
            }));

            return res.status(200).json(options);
        } catch (e) { 
            console.error("❌ API Fetch Error:", e.message);
            return res.status(200).json([]); 
        }
    }

    // HANDSHAKE: Tells the Monday UI that this field depends on columnId
    console.log("🟦 Sending Field Definition Handshake");
    return res.status(200).json({
        id: "status_value",
        title: "Status Column Value",
        outboundType: "status-column-value",
        inboundTypes: ["status-column-value"],
        contextualParameters: { columnId: "columnId" } // Links to your first field
    });
});

// --- 🚀 THE RECURRING TASK ACTION ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        
        // Extract values using the status_value key
        const { boardId, columnId, status_value, task_name, assignee_id } = inputFields;
        const statusIndex = status_value?.value || status_value;

        // Date Calculation Logic
        const { nth_occurence, day_of_week } = inputFields;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day_of_week?.value || day_of_week)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth_occurence?.value || nth_occurence) - 1) * 7);
        
        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": d.toISOString().split('T')[0] },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [columnId]: { "index": parseInt(statusIndex) } // Setting the status by Index
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

        console.log("✅ Success: Item created with status.");
        res.status(200).send({});
    } catch (err) {
        console.error("❌ Action Error:", err.message);
        res.status(200).send({});
    }
});

// Static Helpers for Nth and Day selections
app.all('/get-nth-options', (req, res) => res.json([
    {title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}
]));

app.all('/get-day-options', (req, res) => res.json([
    {title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},
    {title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}
]));

// Fixed Port for Render
const PORT = 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
