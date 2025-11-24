# Tree Dangler

Tree Dangler helps you create a dangling ornament from laser-cut wood pieces held together by [jump rings](https://www.amazon.com/dp/B09186GVBS). It enables you to:

1. Design the ornament
2. Simulate how it will hang
3. Export the SVG for the laser cutter

[🥳 Try it now @ jasonthorsness.github.io/tree-dangler/ 🥳](https://jasonthorsness.github.io/tree-dangler/)

[![tree-dangler](/img/tree-dangler.gif)](https://jasonthorsness.github.io/tree-dangler/)

Here is an example finished ornament hanging from a ribbon and also held in front of the simulation. The error is parallax; it matches the simulation almost perfectly.

![example-1](/img/example-1.jpg)

You might think, this seems easy, why go to the trouble of writing a computer program to do this? That's what I thought too, until I tried three times to _manually create_ this tree ornament. What I found is that some rings are under tension, some are under compression, and with the loose fit it's actually incredibly difficult to predict how the final result will hang. I failed miserably: pieces touched, uneven gaps, the whole thing was askew. So if you have incredible intuition for physics, you might not need this program. But if you need some help like I did, and want a perfect result every time, read on!

## How To Make An Ornament

[Open Tree Dangler](https://jasonthorsness.github.io/tree-dangler/) and click "Load / Empty". You will see a triangle:

![how-1](/img/how-1.png)

Find some image on the web to trace. For example, say we are making a cloud. Find an image of a cloud and copy it (like with Snipping Tool, or right-click "Copy Image"). Then go back to Tree Dangler and use CTRL+V to set it as the background of the editor:

![how-2](/img/how-2.png)

Now use the green points and lines to trace the cloud. Add a new point by clicking on the line, remove a point by using the delete or backspace key. If you make a mistake, CTRL+Z should work to undo. You should end up with a fully traced shape. Don't worry about keeping the lines smooth it will be smoother later. Once you are done tracing, use the "Remove Background" button to discard the background image. Also drag the vertical connector to re-connect one end of it to your shape, and move it until the simulator shows the shape is balanced. Use the mouse wheel to make it larger or smaller and drag with the middle mouse button depressed to re-center.

![how-3](/img/how-3.png)

At any time you can Save to save to a file, or Copy Link to effectively save to the clipboard for sharing. For example [here](https://jasonthorsness.github.io/tree-dangler/#H4sIAAAAAAAACm2US2_bMBCE_wvPxoDcBx-6Feixtx6LHIxESIzWUmArQIrA_72QyKUcNCcDw9Hn5e5wP9z5eP3thg_3Op-m5eqGXx_u3Q3MASkf3F83UAzI-XaoumeIVD0JNDadUoYvVc8RYn5SQakc9hlZTZcAjVWXuPMpFFCVWRFLk0PxyPELPRKUG4YgJm_IKmsCB9M5gBo-B4RkOhEobbr4DN_93iNq1QOjWJWxgGsThAOyYSSiNEpkhN6zAg2brF5QrEgllFq6SoAYJCmaGhXMvZK1eVXPDKJ-I0Jq8BxRrL9BFT53f-k3TQpq_qTwxiHvbR6aBck6QCQQ8xO89PkxGl4LuMdAE0r8Ap_DXk6GSI9TRvzib5kjqF03eahdiyWjUPMXBMsBJ7K4aomInV8KYvVHT4jGF2KI-WkPgnBEaXjaUyxSoKlNJcLvA8_7dRlq05Jc7DV8Kl8pIGjnZGuPcraha0CwbqpGhIbZGmJ6EuTmD_7OnxJyHZakjNDlYNkRyaB0h28JFKI9r8oJ2vyeoXtgCbHGnrf3-IWewt419QnJHmfZ_ZIT7On7u95HD1-rZ-peUat9XUml60yQxuaE0jtP0l94kH1Sd0GgXPbXdhccSgS2ibAKQttzUdbaH24Hdx2fz6NtyetyvCzr5lzzXWJfc0FvBzdOT-2IOX8-Wsb3xQ315_ZwcI_zNI2Py3z5H8stLMSyLZ97rB3ldnSen8YNO11P87SRp_l0HVf_8_HVDXRwl_ltBVA7-nZ-_XNa3tbvuEk_x_HJDf6uqh_j9Ly8rBvo4F7mP-P30_E8LuPFDQH5dvsHv4IOH0EGAAA) is the link from this example project.

Now left-click to add pieces to the cloud. Each piece will have text associated with it. Don't add too many pieces or it will get hard to connect them in a way where they hang nicely. Don't worry about the exact text placement, you will fine-tune the text position and font later in InkScape. If you don't want to be distracted by the simulation while adding pieces you can switch to the SVG view. [Here](https://jasonthorsness.github.io/tree-dangler/#H4sIAAAAAAAACn2Uy27bSBBF_6XXwkXXqx_cZWY2AbLL7IIsjIiwiJFIw6KBDAz9e0Cym6QiI9vbxcN63Kp3d3m6_uead_cydP14dc23d_fTNSKEmA7uf9dwIKR0Oyy6F6guelRYKDrHBJ8XPQVojWdT5IUjPiFZ1ZVgYdE1bHymDF5kMYRcZMoeKXygB4ZJwTC0yjNykS1CqOpC4IJPBIpVZwbHWVef4Nd47xFs0UmQa5YhQ5YmqBBSxWhALpQgoLVnGUazbF6Ra5LGyEvqpgStkGgoajCIrJlMzVv0JGBeK2LEAk8BufaXzODTGp_XSqOBS3w0-Mph7-s8LCli7QCzQms8w-s6P0HBW4asNrCIHD7AJ9rSSVBd7ZQQPvitSACXcqOH1bJEEzKX-AyqPpDI1a6WA8LKzxlhiQ-eESpfWaA1njcjqATkgufNxaoZFstUAvw28LSVK7A6LU25bsNd-sYEspWTantMUh26Eah20yyACmZuSNWjIpV48rv4GJGWYWlMoFWm6h3VBI47fHGgMm9-NYmwEu8FthmWERbby7yPH-iRtq6Zj4h1OfMWrymirr7f9T54-CV74TVWreY-naS86sLQwpaIvHaedd1w0m1SOyNwytu27YzDkSF1ImIKKncu6JT799vBXdvnS1uv5HV8eh2nyzn5O4f1zJHdDq7tj-VJJN0_je3P0TXur_bU9Uc3_W9PIlHksnDC8wbtYCy8OoIZMW-8r2_9I8wHSC4XyebJ72AUBFLsIjvSv6f2gSQUkeuPFfk-LYkC3V6ZdmmN3fn8gOPpyhaL8TLWfZU5lOOiRPP1rrS_z8Pb8fqAm_ZTqmMj4j1u2sbfX_9Q6rQ6Wpba83xjdjCjx9da6qnru_75sXeTy7nUw4hy37vJOr-9FuDnq7t9P7gfQ9-3P8bh9dF3Uq4JT65J99z6lMrTZTi2rnFj21-7oZ_J_dBd2yn--enFNXxwr8PbBODy9Onycu7Gt-k7KdLXtj26xu-y-tL2z-NpMtvBnYZz-0_3dGnH9tU1hHS7_QLYE1qlYggAAA) is my progress so far.

![how-4](/img/how-4.png)

If you want the pieces more rounded, use "settings" to adjust the noise, rounding, gap, etc. This is also where you should adjust the length of the connectors to match the [jump rings](https://www.amazon.com/dp/B09186GVBS) you have. Also if you are using very thick wood you will need to reduce the effective length of the connector as well (not necessary for 3 mm stock). [Here I've made the cloud more rounded](https://jasonthorsness.github.io/tree-dangler/#H4sIAAAAAAAACm2VSW_jRhCF_0ufhYeurRfdslwC5Da5BXMwRoQtRKIMiwYmMPTfA7IXUpGOfl36WMur8pc7v1z_cfsv9345jtPV7f_-cj_dXoQQ08796_YcCCnddkX3AtWiR4WFqnNM8LnoKUBbPJsiF474hGRNV4KFomtY-UwZXGQxhFxlyh4pPNEDw6RiGNrkBVlkixBquhC44hOBYtOZwXHR1Sf4Hu89ghWdBLllGTKkNEGFkBpGA3KlBAH1nmUYLbJ5RW5JGiOX1E0J2iDRUNVgEOmZzM0rehIw94oYscJTQG79JTP41ONzrzQauMZHg28c9r7Nw5Iitg4wK7TFM7z2-Qkq3jKk28AicniCT7Smk6Da7ZQQnnxWJIBrudHDWlmiCZlrfAY1H0jkZlfLAaHzc0Yo8cEzQuMrC7TF82oElYBc8by6WDXDYp1KgF8HntZyBdampSm3bbhL35hA1jmptccktaEbgVo3zQKoYpaGND0qUo0nv4mPEakMS2MCdZmad1QTOG7w1YHKvPrVJMJqvBfYalhGKLaXZR-f6JHWrpmPiG058xqvKaKtvt_0Pnj4kr1wj1Vruc8nKXddGFrZEpF751n7hpOuk9oYgVNet21jHI4MaRMRU1C9c0Hn3L_fdu46vJ6HdiWv08vHNF_O2d859DNHdtu5YTzUJwm-1sSLEdw0_Jzc3v06vB3Hg5u_tyWRKHJdOOFlgzYwjgKpRuSIGFbet8_xEeY9qFStSRDlDkZREeq9UgFvYH-9DQ-w-a7XG6yZl1Fsy8yEbM8zm46n0yPOK5rJFP8rM4d6XZRoOd-N9dvp8nm4PsBUqd0RicUOG9y8jtK-dZ_bs0LVcr95VP7ZbGBGCVp33vNygnqhb8fxOL4-ABeb1zFwXK7TXedCu2lKXIZUgX9c3e37zv24jOPwY7p8PBpP6jnh2TbpntueUn06Xw6D27tpGK_Hy7iQx8vxOszxry_vbs8793H5nAFan345v5-O0-f8O1-lb8NwWP7qWf05jK_T2-y2nXu7nIbfjy_nYRo-3J6Qbrf_AC-CSXxjCAAA).

![how-5](/img/how-5.png)

Next is the tricky part: with the simulation view visible, add connectors until all the pieces are connected and hang correctly. You will likely find that some connectors are under compression, instead of tension, and these connectors will not keep the pieces apart. These connectors can be selected and put into "compression" mode, which will adjust the through-hole placement to maintain correct spacing under compression. This takes some practice. Once you have everything simulating nicely, switch back to the SVG view and make sure no holes are touching each other or the edges of the shapes. [Here is my result](https://jasonthorsness.github.io/tree-dangler/#H4sIAAAAAAAACo1Xy27rNhD9F62NA3IeHNK7PjYFurvdFVkEiZAYje0gdoBbBPn3ghJJybILa-mZ0fE8zwy_uv3j6Z9u-9W9H3eH86nb_v3V_ey2zB4WN92_3ZaCR4zfm1HuGCKj3AQaipwswqVRHgOk2pMK0ojDLiJqlYuHhlEuYcInn0CjmBUhFbFPDjHckAeCcoEhSBUPkKNYDeyrnD2owEcPb1VOBLJBLi7CNXvnEHSUe0aqXoYEHpMg7BErjASkghIYvuUsQf0gVidI1UklpNF1FQ-pIKYo0qBgbp7k5I3yyCBqERGsgMeAVPPrVeFis08tUlNQsTeFqzjkXK2HRoHVDBAJpNoTnLT6MQq8JnBrAzWkcAM--smdCJHWThHhxt8yB1AJ1xy0hsUSkajYJ_jaB2xU21VTQGj4KSGM9sERQsUXYki1p6kRhANSgaepi0US1EpVAtxU8DiFy9BaLYmpTsOF-0oeXhtOrOlRjrXo6uFrNlUDfIEZElLlJojF3ruZvRniWCyxCN_EvvaOSATZDL50oBBN_aps0GLvGDo1LCGMbc_DPN6Qm5-yps5gdTjTZC_RUEffzXIfHNzoPVOzFa2-Z0pKTc4EKdhsSC3zJG3CvUyVmjUCxTRN26xxyAhcK8Iq8IXngmTfH7433al_2feVJU_nx49zZs7c3yk0mvP6ven6w3NRcXAlJhoaoTv3P8_dtvu1f90dnrv8f3Mkz4JUBo5pmKAZGBmDSyOSwcKE9-PzcA3mHPwYtUSG8QWYN0EofCUMmoH99dpfgWVeLxwsiYZSzMNMHklve3bevb1dwzlBbTLBIswUCruI9wN9V6zf3o6fz6crMBFfeYRtbIcZXB5Hrv916dutQEVT4zw_LpsZmFJoM-xsGL4W6OvusDu8XAEObV7KQDaw00XmQuU08TQWqQD-ceq-Hzbd0_Fw6J_Ox4_rxuPiSt6nbJe4VZWKan987rttd-4Pp93xulkoElwdNUH0lyVRV8rFmenSfTx2CitwaWCFOVx0cEWbmdZPeE_H_ftHf7qNKVYaI18NRotJU_iCmRhhhYvB4Nv1kC4LPV4Ije7SihSKo8oaTA6XE5J7tHKEujG_9_xLrp03rIiXDgrFmowQB6q7X-IETeVwKXQ0C5jb8s60S-tKkk8dq5gMvqyz-FA3Yd49g3YNaL6ZSuDRwfNiYrgtruFCWwfqg9UjhC1hQYZscOWmyzfoiu7xFtuuSR4UF-zatLnyFFeUhxVcPskXwcLDGOqpJ-rgVkZNpjBrx6qXxRw2prWENVNd1ll2IS3nzxVaLKo1A-24niwcZckSrIRYR1DgV7KEuRpxZuhFFh3Xpaciw8G8qnfU2uQYIS5A83lTztL8lKAVtQ7tVZAzv-Bu0umepfE5dbcwHNsFn8_VsNio7b2VL8_AK8NO7SGVt6K7JAyiiU6yYVgHqhRBBZQikl_s10lrRXuPdiMh1veYYrn8J2Uclffg8pHc7hxakGS6Ut6DCw5c30p-ZJY5QfJUmAhL_5PDh013OO5Off7s5fG929Km-zh-Zhwpql_272-782f-1hXRj75_Hn61E-LP_vByfs1zsOlej2_977vHfX_uP7qtR_z-_g804OPgEBAAAA) for the cloud:

![how-6](/img/how-6.png)

At this point you should Save your work, and Export SVG. You will need to do some post-processing in [InkScape](https://inkscape.org/). Load the exported SVG in InkScape, and adjust the text font and location to exactly where you want it. Also, if you will be hanging the ornament from a thicker ribbon, you might want to enlarge the hole the ribbon will go through. Here I've chosen a different font, adjusted the placement, and made a larger hole:

![how-7](/img/how-7.png)

Now, ⚠️ **DO NOT FORGET THIS KEY STEP** ⚠️: Select All in InkScape (CTRL+A) and use _Path/Object To Path_. Then save the SVG; it is ready for laser cutting!

In GlowForge, you want to Cut the holes and outlines, and Engrave the text.

![how-7](/img/how-8.png)

Once the pieces are cut, use some needle-nose pliers to add a jump ring according to your connector scheme. Refer back to Tree Dangler to see which holes are paired. It might hang funny in intermediate states, but once all the pieces are together, your result should match the simulation. Good luck!

![how-9](/img/how-9.jpg)

## How It Works

Tree Dangler was 99% vibe-coded using [Gemini](https://developers.google.com/gemini-code-assist/docs/gemini-cli). So, the code is a little messy and confused, and the undo functionality is occasionally flaky. So don't consider the source a paragon of quality. But, if you'd like to understand it, [check out this article](https://www.jasonthorsness.com/34).

## More Examples

Made something cool? Select "Copy Link" and submit a PR here to share!

## License

The license is MIT.

## Contributing

Feel free to fork or submit a patch.
