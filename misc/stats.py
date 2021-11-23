import sqlite3
import matplotlib
import matplotlib.pyplot as plt
from datetime import datetime


db = sqlite3.connect('/Users/mwni/Documents/xrpl/meta.new.db')

rows = db.execute('SELECT date, SUM(accounts) FROM Stats GROUP BY date ORDER by date ASC').fetchall()

rows = [(d,c) for d,c in rows if c > 100000]
dates = [datetime.fromtimestamp(d) for d,c in rows]
counts = [c for d,c in rows]


fig, ax = plt.subplots()
ax.get_yaxis().set_major_formatter(
	matplotlib.ticker.FuncFormatter(lambda x, p: format(int(x), ',')))

plt.title('Number of Trustlines')
plt.plot(dates, counts)
plt.show()