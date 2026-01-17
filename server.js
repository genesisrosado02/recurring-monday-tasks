const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => res.status(200).send("OK"));

// Dropdown Endpoints (Used by the Recipe Builder to show choices)
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

// The ACTION: This runs when the trigger (the 1st of the month) fires
app.post('/calculate-task-with-tag', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        
        // DEBUG: This will show everything in your Render logs
        console.log("📥 Full Input Data:", JSON.stringify(inputFields, null, 2));

        const { boardId, groupId, tagsColumn, tag_names, task_name } = inputFields;

        // Logic to calculate the Nth Day of the current month
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1); 
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
        const dueDate = d.toISOString().split('T')[0];

        // Format the Tags: If tag_names is missing, send an empty array to avoid API errors
        const tagValue = tag_names ? [tag_names] : [];

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": dueDate },
            [tagsColumn]: { "tag_ids": tagValue } 
        };

        const query = `mutation { 
            create_item (
                board_id: ${parseInt(boardId)}, 
                group_id: "${groupId}", 
                item_name: "${task_name}", 
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id } 
        }`;

        const response = await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2024-01' } 
        });

        if (response.data.errors) {
            console.error("❌ Monday API Error:", JSON.stringify(response.data.errors, null, 2));
        } else {
            console.log(`✅ Success! Task Created. Item ID: ${response.data.data.create_item.id}`);
        }
        res.status(200).send({});
    } catch (err) {
        console.error("❌ Server Error:", err.message);
        res.status(200).send({});
    }
});

const PORT = 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
