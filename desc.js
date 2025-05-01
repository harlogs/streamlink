const axios = require('axios');
const cheerio = require('cheerio');
const levenshtein = require('fast-levenshtein');

// Function to get movie description from Wikipedia
async function get_url(movieTitle) {
  try {
    // Format the movie title for the Wikipedia URL
    const url = `https://en.wikipedia.org/w/index.php?fulltext=1&search=${encodeURIComponent(movieTitle)}`;

    // Fetch the page HTML content
    const { data } = await axios.get(url);

    // Load the HTML into cheerio
    const $ = cheerio.load(data);

   // Step 1: Collect all hrefs
   const hrefs = [];
   $('a[href]').each((index, element) => {
     const href = $(element).attr('href');
     const text = $(element).text();

     // Only consider Wikipedia article links
     if (href && href.startsWith('/wiki/') && !href.includes(':')) {
       hrefs.push({
         fullHref: 'https://en.wikipedia.org' + href,
         hrefTitle: text.trim()
       });
     }
   });

   // Step 2: Match movieTitle with hrefTitle
   let bestMatch = '';
   let bestScore = -1;

   hrefs.forEach(({ fullHref, hrefTitle }) => {
     const distance = levenshtein.get(movieTitle.toLowerCase(), hrefTitle.toLowerCase());
     const maxLen = Math.max(movieTitle.length, hrefTitle.length);
     const matchPercentage = ((maxLen - distance) / maxLen) * 100;

     if (matchPercentage > bestScore) {
       bestScore = matchPercentage;
       bestMatch = fullHref;
     }
   });

   console.log('Best Match:', bestMatch);
   
   return bestMatch.toString();
  } catch (error) {
    console.error("Error fetching movie description:", error);
  }
}
async function get_desc(movieTitle) {
  try {
      let urls='';
      urls = await get_url(movieTitle);

       // Fetch the page HTML content
    const { data } = await axios.get(urls);

     // Load the HTML into cheerio
     const $ = cheerio.load(data);

     const paragraphs = $('div.mw-parser-output > p');
     let descriptions = [];
     let totalLength = 0;
     
     paragraphs.each((index, element) => {
       const text = $(element).text().trim();
       if (text.length > 0) {
         descriptions.push("<p class=\"w-full text-white text-justify py-2 mt-4 px-4 overflow-auto break-words\">"+text+"</p>");
         totalLength += text.length;
     
         if (totalLength >= 2000) {
           return false; // Stop when we reach or exceed 500 characters
         }
       }
     });
     
     // Join all collected paragraphs
     const fullDescription = descriptions.join('\n\n');
     
     if (fullDescription) {
       console.log(`\nDescription for "${movieTitle}":`);
       console.log(fullDescription);
     } else {
       console.log("No description found.");
     }
     return fullDescription;
  } catch (error) {
    console.error("Error fetching movie description:", error);
  }
}

// Example: Fetching description for the movie "Azaad 2025"
//get_desc('Azaad 2025'); 
module.exports = { get_desc };
