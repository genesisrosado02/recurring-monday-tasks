const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

// --- 🕵️ DEBUG LOGGING ---
app.use((req, res, next) => {
    console.log(`📡 [REQUEST]: ${req.method} ${req.path}`);
    console.log("📦 Body:", JSON.stringify(req.body));
    next();
});

// --- 🛠️ THE DYNAMIC MAPPING HANDLER ---
// Put this URL into your "Field Definitions URL" box
app.post('/status-logic', async (req, res) => {
    const payload = req.body.payload || req.body;
    
    // 1. Check if Monday is asking for the LABELS (Fetch Phase)
    // Monday sends boardId and columnId once the user picks them
    const { boardId, columnId } = payload; 

    if (boardId && columnId) {
        try {
            console.log(`🔍 Fetching labels for Board ${boardId}, Column ${columnId}`);
            const query = `query { boards (ids: ${boardId}) { columns (ids: "${columnId}") { settings_str } } }`;
            const response = await axios.post('https://api.monday.com/v2', { query }, {
                headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2024-01' }
            });

            const settings = JSON.parse(response.data.data.boards[0].columns[0].settings_str);
            
            // Format for Dynamic Mapping fields
            const fields = Object.entries(settings.labels).map(([id, label]) => ({ 
                id: id,            // The index/ID
                title: label,       // The text the user sees
                outboundType: "text",
                inboundTypes: ["text"]
            }));

            console.log(`✅ Sending ${fields.length} labels back to Monday.`);
            return res.status(200).send(fields);
        } catch (e) { 
            console.error("❌ API Error:", e.message);
            return res.status(200).send([]); 
        }
    }

    // 2. THE HANDSHAKE (Initial Phase)
    // If no board/column is sent yet, we tell Monday what this field IS.
    console.log("🟦 Sending Field Definition Handshake");
    return res.status(200).send([
        { 
            id: "status_value", 
            title: "Status Column Value", 
            outboundType: "text", 
            inboundTypes: ["text"] 
        }
    ]);
});

// --- 🚀 THE MAIN ACTION ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        
        const { boardId, columnId, status_value, task_name, assignee_id } = inputFields;
        
        // Extracting the value from the dynamic mapping object
        const statusIndex = status_value?.id || status_value;

        // Date Logic (standard)
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": d.toISOString().split('T')[0] },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [columnId]: { "index": parseInt(statusIndex) } 
        };

        const query = `mutation { create_item (board_id: ${parseInt(boardId)}, item_name: "${task_name}", column_values: ${JSON.stringify(JSON.stringify(columnValues))}) { id } }`;
        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
        });

        res.status(200).send({});
    } catch (err) {
        res.status(200).send({});
    }
});

// Helpers
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

app.listen(10000, '0.0.0.0');
